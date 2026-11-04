# Research notes — the pay-to-rank wave (checked 4 Nov 2026)

Sources are public posts/teardowns; all revenue/visitor numbers are
**founder-reported, not independently audited**. Conflicts between snapshots
are flagged, not smoothed over.

## The original: outbid.lol

- Founder: Jonathan Wilke, German indie hacker (Osnabrück), creator of
  supastarter (SaaS starter kit for Next.js / Nuxt / SvelteKit, ~$10K MRR).
- Launched 19 Aug 2026, 11:08 PM CEST, after ~3 hours of work, built with
  Grok inside Cursor on his own supastarter stack (Next.js, PostgreSQL +
  Prisma, tRPC). One post on X: "No ads. No API keys. No revenue sharing."
  Zero ad spend; 100% organic X traffic — into an audience he already had.
- Reported trajectory: 24h $21,499 / 200k+ visitors / $10,000 top bid →
  48h ~$120k–$132k / 1.1M+ visitors → ~65h $139,041 direct payment volume
  (tracker reading via /api/revenue) → week 1 (26 Aug recap) $221k,
  1.36M visitors, 1,582 bids, top spot ~$17,001, 300+ clones. A $100k
  acquisition offer was reportedly declined.

## The mechanic — where sources conflict, and what we implemented

| Rule | What sources say | Implemented |
|---|---|---|
| Minimum | It has moved over time: $2 at launch (Aug reports), $5 in late-Aug snapshots, and **$10 on the original's own current Rules page** (read live 4 Nov 2026). | New listing min **$10** (config in `lib/rules.js`) |
| Boards | The original runs three: All-time (cumulative, never expires), Today (spend since midnight UTC, resets daily), Daily (frozen per-day archives since 21 Aug 2026). One payment counts on every board it falls in. | All-time + Today implemented; Daily archive not yet |
| Payments today | The original's FAQ names **Dodo Payments** as its processor (an earlier provider reportedly shut it down mid-run). | Stripe in our build; Dodo is a candidate — see LAUNCH.md |
| Increments | Whole dollars, $1 increments | Whole dollars only, $1 steps |
| Cumulative? | Yes — rank = total dollars paid; topping up pays only the difference | Yes — `total` accumulates; a top-up charges only the added amount |
| Taking #1 | Rulebook snapshot: at least $5 more than the current top total. One reel said $1 — wrong per the rulebook | Resulting total must be ≥ leader + $5 |
| Tie-break | Older entry wins | Sort by total desc, then createdAt asc |
| Cap | $999,999 max total (rulebook snapshot) | Enforced |
| Other | No accounts, no ads, no API keys, no revenue share; nothing expires; payments non-refundable | Same, stated on the page |

## The original today (its own About counters, read 4 Nov 2026, ~19:18 IST)

Live counters on outbid.lol/about: **$267,778 total revenue, 1,683,580
visitors, $17,001 highest rank, 3,197 listed products — and $34 of revenue
today, with 4 products added today.** The board that did ~$139k in 65 hours
in August is now doing tens of dollars a day. That is the strongest
evidence of what the mechanic is worth once the novelty wave passes —
for the original itself, with all its traffic and reputation.

Other rules from the original's own Rules/FAQ pages: raising your rank
means entering the same URL/handle again — the new total must be at least
$1 above your current one and checkout charges only the difference; chat
and invite links (Telegram, WhatsApp, Discord…) and NSFW listings are
banned; query parameters are stripped (no affiliate/tracking URLs);
link shorteners are resolved to their destination; payments are final and
non-refundable, including if you are later outranked.

## The clones — the part that decides whether this makes money

- 173–350+ boards were tracked within days (outbid.fyi, awesome-outbid,
  afford.bid): spotfight.live, topapp.lol, xbid.lol, payluck.lol,
  lowbid.lol, rankwars.lol, outbidception.lol, and hundreds more.
- The consistent finding across teardowns: **traffic concentrated almost
  entirely on the original board.** Clones reproduced the mechanic in hours
  but not Wilke's launch reach — he launched into an existing X audience in
  the indie-hacker / AI-builder community at the exact moment the mechanic
  was novel.
- Entry bids on clone boards typically ran $5–$50 and most boards went
  quiet quickly.

## Honest conclusion for this build

The product is an afternoon build — for Wilke and for us. The revenue was
never in the code; it was in (1) novelty in Aug 2026, (2) a pre-built X
audience, (3) the live public revenue counter creating FOMO, and
(4) bidders sharing their rank for clicks. By Nov 2026 the mechanic is
three months old and heavily cloned, so a straight clone should be treated
as a lottery ticket with a real but low hit rate — not a 3-day income plan.
The launch plan in LAUNCH.md is built around the only lever that mattered
for the original: distribution into a community, with a niche twist.
