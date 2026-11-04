# LAUNCH.md — deploy + distribution plan

## What exists right now

A working, original implementation of the pay-to-rank mechanic:
- One-page live leaderboard (auto-refreshes every 5s), live stats
  (revenue / visitors / top bid / bid count), click tracking per listing.
- Rules enforced server-side and unit-tested (`npm run test:rules`):
  $10 min entry (the original's current official minimum — it was $2 at
  launch and $5 later in August), whole dollars, $1 top-ups paying only
  the difference, cumulative totals, #1 requires leader + $5 on both the
  All-time and the Today (UTC-day) boards, older listing wins ties,
  $999,999 cap.
- Payments: Stripe Checkout + signed webhook (`/api/webhook`) is the only
  path that can move the board with real money. `/api/revenue` counts
  **settled live payments only**.
- With no Stripe keys it runs in clearly-labelled DEMO mode — bids are
  simulated and never counted as revenue. No fake dashboards.

## To take real money (deploy checklist)

1. **Domain** — a short, funny domain is part of the product. `.lol`
   first-year registrations were ~$0.99 in Aug 2026. Pick a name that is
   NOT "outbid" (avoid passing off as the original) — a niche angle works
   better now, e.g. a board only for Indian startups, only AI tools,
   or only Shopify apps.
2. **Hosting** — Vercel: import this folder as a project (framework:
   Next.js), set env vars below, deploy. For production data use the
   Prisma/Postgres schema in `prisma/schema.prisma` (Vercel Postgres or
   Neon) and swap `lib/store.js` to Prisma — locally it uses a JSON file,
   which is fine for a launch-day test but not for real traffic.
3. **Payments — DECIDED: Razorpay adapter is BUILT and verified**
   (14 unit tests + a full mock-API end-to-end: order → forged signature
   rejected → genuine verify credits → webhook settles → duplicates
   blocked). The remaining steps are account-side, and only the account
   owner can do them (keys must never travel through chat):
   a. In the Razorpay Dashboard (the merchant account already activated
      for your store): Settings → API Keys → generate a **live** key pair.
      (This direct API pair is separate from the Razorpay app connected
      to Shopify.)
   b. Settings → Webhooks → add `https://<domain>/api/webhook/razorpay`
      with events `payment.captured` + `order.paid`, and keep its secret.
   c. Paste Key ID, Key Secret and Webhook Secret into the HOST's env
      settings (Vercel project → Settings → Environment Variables) —
      never into chat, never into the repo.
   d. Decide the charge currency: USD requires "International Payments"
      enabled on the account (Dashboard → Settings); otherwise set
      `RAZORPAY_CURRENCY=INR` and `USD_INR_RATE` (e.g. 84) and Indian
      buyers pay the converted amount by card/UPI/netbanking.
   Alternatives kept in code: Stripe, and Dodo Payments (below).
   a. Stripe via an existing eligible account, or
   b. **Dodo Payments** — notable because the original outbid.lol itself
      now runs on Dodo (per its own FAQ, after its first provider cut it
      off mid-run). Dodo is a merchant-of-record aimed at indie sellers
      taking global card payments; check its current India eligibility,
      fees and payout timing on its own site before relying on it, or
   c. Add a Razorpay checkout adapter next to the Stripe one (the
      checkout/webhook split in `app/api/` is designed for this) — the
      realistic domestic route to taking money tomorrow, or
   d. Sell access/listings through your existing Shopify store as a stopgap.
   Keys go into the host's env settings only — never into chat.
4. **Webhook** — point Stripe's webhook at `https://<domain>/api/webhook`
   for `checkout.session.completed`, put its secret in
   `STRIPE_WEBHOOK_SECRET`.
5. **Test with a real $10 payment** from a second card/person, confirm the
   listing appears and `/api/revenue` moves, before posting anywhere.

## Distribution — the only part that made the original money

Wilke had an X audience already. We start colder, so the plan leans on
borrowed audiences and a niche:

- **Pick a niche board, not a general one.** General clones are the ones
  that died. "Pay to rank your AI tool / Indian startup / Shopify app"
  gives a community a reason to care and a place to post it.
- **Seed the board before posting publicly**: 5–10 friendly founders list
  at $10–$25 so the board isn't empty (real payments, from them, for their
  own listings — never fake self-bids presented as revenue).
- **Launch posts**: X thread in the indie-hacker style of the original
  ("No ads. No accounts. Rank is the bid."), the live revenue screenshot
  as the hook, plus LinkedIn (your current audience) and your existing
  Facebook/YouTube channels with a "watch the board move" angle.
- **The loop**: every bidder gets a shareable rank ("I'm #3 on X — outbid
  me") — bidders promoting themselves is what carried the original.
- **48-hour watch**: if no organic bids beyond the seed group arrive in
  48h, the honest read is the wave has passed for a general clone; the
  fallback is the niche angle or folding the mechanic into an existing
  community you already reach.

## Expectations, stated plainly

- Wilke's numbers ($21k/24h, ~$139k/65h) came from novelty + a ready
  audience in Aug 2026. 300+ clones since then mostly made little or
  nothing — that is the base rate for this build in Nov 2026.
- A realistic good outcome for a cold-start niche board: the board pays
  for itself and brings a few hundred dollars over a launch week, with a
  small tail chance of catching a viral moment. Treat anything above
  that as upside, not a plan.
- This does not replace the ₹3 lakh sprint's existing tracks; it's a
  cheap, fast lottery ticket alongside them (build cost: one evening).
