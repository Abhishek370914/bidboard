import { NextResponse } from "next/server";
import Stripe from "stripe";
import { applyPayment } from "../../../lib/store";

export const dynamic = "force-dynamic";

// Stripe webhook — the ONLY path that can create/top up a listing with real money.
// Verifies the signature with STRIPE_WEBHOOK_SECRET, then applies the payment idempotently.
export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    if (s.payment_status === "paid") {
      const m = s.metadata || {};
      const addUsd = parseInt(m.add_usd, 10);
      if (m.target_key && Number.isInteger(addUsd)) {
        await applyPayment({
          paymentId: s.id,
          target: { key: m.target_key, title: m.target_title, url: m.target_url, kind: m.target_kind },
          addUsd,
          mode: "live",
          provider: "stripe",
        });
      }
    }
  }
  return NextResponse.json({ received: true });
}
