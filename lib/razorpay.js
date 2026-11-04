// Razorpay adapter — server-side only. Keys come from env vars, never from code or chat.
// Docs grounding (checked 4 Nov 2026):
// - Every payment starts with a server-side Order (Orders API, Basic auth key_id:key_secret,
//   amount in the smallest currency unit — cents for USD, paise for INR).
// - Checkout success signature: HMAC-SHA256(key_secret, "<order_id>|<payment_id>").
// - Webhook signature: HMAC-SHA256(webhook_secret, raw request body), header x-razorpay-signature.
// - The checkout signature does NOT cover amount or notes, so before crediting a bid we
//   ALSO fetch the payment and the order from Razorpay's API and check status + amount + notes.
import { createHmac, timingSafeEqual } from "crypto";

export function razorpayConfig() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    // Board prices are USD. Charge in USD (needs Razorpay "international payments"
    // enabled on the account) or set RAZORPAY_CURRENCY=INR + USD_INR_RATE to charge
    // the converted rupee amount domestically (cards/UPI/netbanking).
    currency: (process.env.RAZORPAY_CURRENCY || "USD").toUpperCase(),
    inrRate: Number(process.env.USD_INR_RATE || 0),
    apiBase: process.env.RAZORPAY_API_BASE || "https://api.razorpay.com/v1",
  };
}

export function razorpayConfigured() {
  const c = razorpayConfig();
  return Boolean(c.keyId && c.keySecret);
}

/** Minor units to charge for a USD bid amount, in the configured charge currency. */
export function chargeAmountMinor(addUsd) {
  const c = razorpayConfig();
  if (c.currency === "USD") return { amount: addUsd * 100, currency: "USD" };
  if (c.currency === "INR") {
    if (!c.inrRate || c.inrRate <= 0) {
      throw new Error("RAZORPAY_CURRENCY=INR requires USD_INR_RATE to be set (e.g. 84).");
    }
    return { amount: Math.round(addUsd * c.inrRate) * 100, currency: "INR" };
  }
  throw new Error(`Unsupported RAZORPAY_CURRENCY: ${c.currency}`);
}

function authHeader() {
  const c = razorpayConfig();
  return "Basic " + Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64");
}

async function api(path, options = {}) {
  const c = razorpayConfig();
  const res = await fetch(`${c.apiBase}${path}`, {
    ...options,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = json?.error?.description || text || `HTTP ${res.status}`;
    throw new Error(`Razorpay API ${path} failed: ${msg}`);
  }
  return json;
}

/** Create an order carrying everything the webhook/verify paths need in `notes`. */
export async function createOrder({ addUsd, target }) {
  const { amount, currency } = chargeAmountMinor(addUsd);
  const order = await api("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount,
      currency,
      receipt: `bb_${Date.now()}`,
      payment_capture: 1,
      notes: {
        target_key: target.key,
        target_title: target.title,
        target_url: target.url,
        target_kind: target.kind,
        add_usd: String(addUsd),
      },
    }),
  });
  return { order, amount, currency };
}

export function fetchOrder(orderId) {
  return api(`/orders/${orderId}`);
}

export function fetchPayment(paymentId) {
  return api(`/payments/${paymentId}`);
}

function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Checkout success signature: HMAC-SHA256(key_secret, "order_id|payment_id"). */
export function verifyPaymentSignature(orderId, paymentId, signature, secret = razorpayConfig().keySecret) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256(webhook_secret, raw body). Body must be the exact raw string. */
export function verifyWebhookSignature(rawBody, signature, secret = razorpayConfig().webhookSecret) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

/**
 * Authoritative settle check shared by the verify endpoint and the webhook:
 * confirms the payment is captured, belongs to the order, the amount matches
 * the order, and returns the bid details from the ORDER's notes (server-fetched,
 * never client-supplied).
 */
export async function settleFromIds(orderId, paymentId) {
  const [order, payment] = await Promise.all([fetchOrder(orderId), fetchPayment(paymentId)]);
  if (!payment || payment.order_id !== orderId) throw new Error("Payment does not belong to this order.");
  if (payment.status !== "captured") throw new Error(`Payment not captured (status: ${payment.status}).`);
  if (Number(payment.amount) !== Number(order.amount)) throw new Error("Payment amount does not match order amount.");
  const n = order.notes || {};
  const addUsd = parseInt(n.add_usd, 10);
  if (!n.target_key || !Number.isInteger(addUsd)) throw new Error("Order is missing BidBoard notes.");
  return {
    target: { key: n.target_key, title: n.target_title, url: n.target_url, kind: n.target_kind },
    addUsd,
  };
}
