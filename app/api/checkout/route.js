import { NextResponse } from "next/server";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import { getState, applyPayment, todayTotals } from "../../../lib/store";
import { normaliseTarget, validatePayment } from "../../../lib/rules";
import { razorpayConfigured, razorpayConfig, createOrder } from "../../../lib/razorpay";

export const dynamic = "force-dynamic";

// POST { target: "https://example.com" | "@handle", addUsd: 25 }
// Provider priority: Razorpay (if keys set) → Stripe (if key set) → Demo.
// - Razorpay: creates an Order server-side and returns everything the browser needs to
//   open Razorpay Checkout. The bid is credited ONLY by /api/checkout/razorpay/verify
//   or the Razorpay webhook after signature + API checks — never by this route.
// - Stripe: creates a Checkout session; the signed webhook credits the bid.
// - Demo: no provider configured. Applied immediately as mode:"demo", excluded from revenue.
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const target = normaliseTarget(body?.target);
  const addUsd = body?.addUsd;
  if (!target) {
    return NextResponse.json({ error: "Enter a valid website URL or @X handle." }, { status: 400 });
  }
  const data = await getState();
  const check = validatePayment({ listings: data.listings, key: target.key, addUsd, todayTotals: todayTotals(data) });
  if (!check.ok) {
    return NextResponse.json({ error: check.error, minCharge: check.minCharge }, { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (razorpayConfigured()) {
    try {
      const { order, amount, currency } = await createOrder({ addUsd, target });
      return NextResponse.json({
        mode: "razorpay",
        orderId: order.id,
        keyId: razorpayConfig().keyId, // public key id — safe to expose, the secret never leaves the server
        amount,
        currency,
        targetTitle: target.title,
      });
    } catch (err) {
      return NextResponse.json({ error: `Payment provider error: ${err.message}` }, { status: 502 });
    }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    const paymentId = `demo_${randomUUID()}`;
    await applyPayment({ paymentId, target, addUsd, mode: "demo", provider: "demo" });
    return NextResponse.json({ mode: "demo", applied: true, paymentId, resultingTotal: check.resultingTotal });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: addUsd * 100,
          product_data: {
            name: `BidBoard listing — ${target.title}`,
            description: `Adds $${addUsd} to this listing's total. Rank is the bid, nothing else. Payments are non-refundable.`,
          },
        },
      },
    ],
    metadata: {
      target_key: target.key,
      target_title: target.title,
      target_url: target.url,
      target_kind: target.kind,
      add_usd: String(addUsd),
    },
    success_url: `${origin}/?paid=1`,
    cancel_url: `${origin}/?cancelled=1`,
  });
  return NextResponse.json({ mode: "live", checkoutUrl: session.url });
}
