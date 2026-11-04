import { NextResponse } from "next/server";
import { applyPayment } from "../../../../../lib/store";
import { razorpayConfigured, verifyPaymentSignature, settleFromIds } from "../../../../../lib/razorpay";

export const dynamic = "force-dynamic";

// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Called by the browser after Razorpay Checkout succeeds. Two independent checks:
// 1. HMAC signature over "order_id|payment_id" with the key secret.
// 2. Server-side fetch of payment + order from Razorpay: payment must be captured,
//    belong to the order, and match the order amount (the signature alone does
//    not cover amount/notes). Bid details come from the ORDER's notes.
// Applying is idempotent on the payment id — if the webhook lands first, this is a no-op.
export async function POST(req) {
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing Razorpay fields." }, { status: 400 });
  }
  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
  }
  try {
    const { target, addUsd } = await settleFromIds(orderId, paymentId);
    const result = await applyPayment({ paymentId, target, addUsd, mode: "live", provider: "razorpay" });
    return NextResponse.json({ ok: true, applied: result.applied, total: result.listing?.total });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
