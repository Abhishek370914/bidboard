// Single source of truth for the board rules.
// Matches the original's OWN current Rules page (read live 4 Nov 2026 —
// see RESEARCH.md). Note the minimum has moved over time: $2 at launch
// (Aug 2026 reports), $5 in late-Aug snapshots, $10 on the current Rules page.
export const RULES = {
  MIN_ENTRY_USD: 10, // a brand-new listing must start at $10 or more (current official rule)
  MIN_TOPUP_USD: 1, // topping up an existing listing: pay only the difference, $1 or more
  INCREMENT_USD: 1, // whole dollars only, $1 increments
  TAKE_FIRST_GAP_USD: 5, // a total that takes #1 must beat the current #1 total by at least $5
  CAP_USD: 999999, // a listing's cumulative total can never exceed this
  CURRENCY: "usd",
};

/**
 * Validate a payment against the board state.
 * @param {object} args
 * @param {Array} args.listings current listings [{key,total,createdAt}]
 * @param {string} args.key normalised key of the listing being paid for (url or handle)
 * @param {number} args.addUsd amount being paid NOW (the charge), whole dollars
 * @param {Object} [args.todayTotals] map key -> dollars spent today (UTC) per listing, for the Today board
 * @returns {{ok:true, resultingTotal:number, isNew:boolean} | {ok:false, error:string, minCharge?:number}}
 */
export function validatePayment({ listings, key, addUsd, todayTotals = {} }) {
  if (!Number.isInteger(addUsd)) {
    return { ok: false, error: "Bids are whole dollars only — no cents." };
  }
  const existing = listings.find((l) => l.key === key) || null;
  const isNew = !existing;
  const currentTotal = existing ? existing.total : 0;

  if (isNew && addUsd < RULES.MIN_ENTRY_USD) {
    return { ok: false, error: `New listings start at $${RULES.MIN_ENTRY_USD} or more.`, minCharge: RULES.MIN_ENTRY_USD };
  }
  if (!isNew && addUsd < RULES.MIN_TOPUP_USD) {
    return { ok: false, error: `Top-ups are $${RULES.MIN_TOPUP_USD} or more.`, minCharge: RULES.MIN_TOPUP_USD };
  }
  if (addUsd <= 0) {
    return { ok: false, error: "Amount must be a positive whole-dollar amount." };
  }

  const resultingTotal = currentTotal + addUsd;
  if (resultingTotal > RULES.CAP_USD) {
    return { ok: false, error: `A listing can hold at most $${RULES.CAP_USD.toLocaleString("en-US")}.` };
  }

  // Current leader, excluding the listing being paid for.
  const others = listings.filter((l) => l.key !== key);
  const leader = others.length
    ? others.reduce((a, b) => (b.total > a.total ? b : a))
    : null;

  // Any payment whose resulting total would take #1 must clear the leader by the gap.
  // The same +$5 rule applies on the Today board, against today's spend (UTC day).
  const required = [];
  if (leader && resultingTotal > leader.total && resultingTotal < leader.total + RULES.TAKE_FIRST_GAP_USD) {
    required.push(leader.total + RULES.TAKE_FIRST_GAP_USD - currentTotal);
  }
  const todayCurrent = todayTotals[key] || 0;
  const resultingToday = todayCurrent + addUsd;
  const todayLeader = others.reduce((max, l) => Math.max(max, todayTotals[l.key] || 0), 0);
  if (todayLeader > 0 && resultingToday > todayLeader && resultingToday < todayLeader + RULES.TAKE_FIRST_GAP_USD) {
    required.push(todayLeader + RULES.TAKE_FIRST_GAP_USD - todayCurrent);
  }
  if (required.length) {
    const minCharge = Math.max(...required);
    return {
      ok: false,
      error: `To take #1 you must beat the current #1 by at least $${RULES.TAKE_FIRST_GAP_USD} — pay $${minCharge.toLocaleString("en-US")} now.`,
      minCharge,
    };
  }

  return { ok: true, resultingTotal, isNew };
}

/** Rank listings: total desc, ties go to the older listing (earliest createdAt). */
export function rankListings(listings) {
  return [...listings].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

/** Normalise a submitted website URL or X handle into a stable listing key + display fields. */
export function normaliseTarget(raw) {
  const input = String(raw || "").trim();
  if (!input) return null;
  if (input.startsWith("@")) {
    const handle = input.slice(1).trim();
    if (!/^[A-Za-z0-9_]{1,30}$/.test(handle)) return null;
    return { key: `x:${handle.toLowerCase()}`, title: `@${handle}`, url: `https://x.com/${handle}`, kind: "x" };
  }
  let url = input;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) return null;
    const clean = u.toString();
    return { key: `url:${clean.toLowerCase()}`, title: u.hostname.replace(/^www\./, ""), url: clean, kind: "site" };
  } catch {
    return null;
  }
}
