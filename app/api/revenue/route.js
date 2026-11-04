import { NextResponse } from "next/server";
import { getState, summarise, kvConfigured } from "../../../lib/store";
import { razorpayConfigured } from "../../../lib/razorpay";

export const dynamic = "force-dynamic";

// Public revenue endpoint — the FOMO engine of the original.
// Honesty rule: totalRevenue counts ONLY settled live payments.
// Demo-mode payments are reported separately and never merged in.
export async function GET() {
  const data = await getState();
  const s = summarise(data);
  return NextResponse.json({
    total_revenue_usd: s.totalRevenue,
    live_payments: s.livePayments,
    total_bids: s.totalBids,
    listings: s.listings,
    visitors: s.visitors,
    top_bid_usd: s.topBid,
    payments_provider: razorpayConfigured() ? "razorpay" : process.env.STRIPE_SECRET_KEY ? "stripe" : "demo",
    storage: kvConfigured ? "kv-persistent" : "ephemeral",
    demo_mode: !razorpayConfigured() && !process.env.STRIPE_SECRET_KEY,
    demo_revenue_usd_excluded: s.demoRevenue,
    generated_at: new Date().toISOString(),
  });
}
