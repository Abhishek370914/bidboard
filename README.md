# BidBoard — pay-to-rank leaderboard

An original implementation of the public pay-to-rank mechanic: anyone can
list a website or X handle, rank is purely the cumulative dollars paid,
and taking #1 means outbidding the leader. No accounts, no ads, no
revenue share.

See **RESEARCH.md** for the fact-checked teardown (and where sources
conflict) and **LAUNCH.md** for the deploy + distribution checklist.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 — DEMO mode until Stripe keys are set
npm run test:rules # 9 unit tests over the bidding rules
npm run build && npm run start
```

## Modes

- **Demo (no keys):** bids apply instantly, are stored as `mode: "demo"`,
  shown under a DEMO banner, and are **excluded** from `/api/revenue`.
- **Live — Razorpay (primary, for India):** set `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (see `.env.example`).
  The server creates a Razorpay Order; the bid is credited only after
  (a) the checkout signature verifies AND the payment is confirmed
  captured with Razorpay's API, or (b) the signed `payment.captured` /
  `order.paid` webhook lands. Idempotent — a payment can never credit twice.
  Charge currency is configurable: USD (needs International Payments
  enabled) or INR via `USD_INR_RATE`.
- **Live — Stripe (alternative):** used when Razorpay keys are absent and
  `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` are set.

## Rules (lib/rules.js — single source of truth)

- New listing: $10 minimum · Top-up: $1 minimum, pays only the difference
- Whole dollars only · Rank = cumulative total · Ties → older listing
- Taking #1 (all-time or today's board): resulting total must beat the current #1 by ≥ $5
- Two boards: All-time (never expires) and Today (spend since midnight UTC)
- Cap: $999,999 per listing · Payments non-refundable

## Stack

Next.js 14 (App Router) · Stripe Checkout + webhooks · JSON store locally,
Prisma/PostgreSQL schema in `prisma/schema.prisma` for production.
