import { NextResponse } from "next/server";
import { applyPayment } from "../../../../lib/store";
import { razorpayConfigured, verifyWebhookSignature, settleFromIds } from "../../../../lib/razorpay";

export const dynamic = "force-dynamic";

// Razorpay webhook — the source of truth if the buyer's browser closes early.
// Signature: HMAC-SHA256(webhook_secret, RAW body) in the x-razorpay-signature header.
// Configure in Razorpay Dashboard → Settings → Webhooks, events: payment.captured, order.paid.
// Replay-safe: applying a payment is idempotent on the Razorpay payment id.
export async function POST(req) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 503 });
  }
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Webhook signature failed" }, { status: 400 });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id || event.payload?.order?.entity?.id;
    if (payment?.id && orderId) {
      try {
        const { target, addUsd } = await settleFromIds(orderId, payment.id);
        await applyPayment({ paymentId: payment.id, target, addUsd, mode: "live", provider: "razorpay" });
      } catch (err) {
        // Return 200 anyway for events that are not ours to settle (e.g. other
        // products on the same Razorpay account) so Razorpay stops retrying;
        // a genuine BidBoard payment that fails here is also recoverable via
        // the buyer's verify call. Log for the operator.
        console.error("razorpay webhook settle failed:", err.message);
      }
    }
  }
  return NextResponse.json({ received: true });
}
