// Demo/local store: a JSON file on disk.
// Production path: prisma/schema.prisma defines the same shape on PostgreSQL —
// swap the functions in this file for Prisma queries and nothing else changes.
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "store.json");

const EMPTY = { listings: [], payments: [], stats: { visitors: 0 } };

async function read() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return structuredClone(EMPTY);
  }
}

async function write(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, FILE);
}

// Tiny in-process lock so concurrent requests don't clobber each other locally.
let chain = Promise.resolve();
function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

export async function getState() {
  return read();
}

export async function recordVisit() {
  return withLock(async () => {
    const data = await read();
    data.stats.visitors += 1;
    await write(data);
    return data.stats.visitors;
  });
}

export async function recordClick(key) {
  return withLock(async () => {
    const data = await read();
    const listing = data.listings.find((l) => l.key === key);
    if (listing) {
      listing.clicks += 1;
      await write(data);
    }
    return listing || null;
  });
}

/**
 * Apply a settled payment: create or top up the listing (cumulative total),
 * append the payment to the ledger. Idempotent on paymentId.
 * mode: "live" (real money, counts toward public revenue) | "demo" (no money moved, never counted as revenue)
 */
export async function applyPayment({ paymentId, target, addUsd, mode, provider }) {
  return withLock(async () => {
    const data = await read();
    if (data.payments.some((p) => p.id === paymentId)) {
      return { applied: false, reason: "duplicate" };
    }
    let listing = data.listings.find((l) => l.key === target.key);
    const now = new Date().toISOString();
    if (!listing) {
      listing = {
        key: target.key,
        title: target.title,
        url: target.url,
        kind: target.kind,
        total: 0,
        clicks: 0,
        createdAt: now,
        updatedAt: now,
      };
      data.listings.push(listing);
    }
    listing.total += addUsd;
    listing.updatedAt = now;
    data.payments.push({
      id: paymentId,
      key: target.key,
      amount: addUsd,
      resultingTotal: listing.total,
      mode,
      provider,
      createdAt: now,
    });
    await write(data);
    return { applied: true, listing };
  });
}

/** Dollars spent per listing since midnight UTC (the Today board's window). */
export function todayTotals(data) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const totals = {};
  for (const p of data.payments) {
    if (new Date(p.createdAt) >= start) totals[p.key] = (totals[p.key] || 0) + p.amount;
  }
  return totals;
}

/** Today's board: ranked by today's spend; ties go to whoever spent first today. */
export function rankToday(data) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const byKey = new Map();
  for (const p of data.payments) {
    if (new Date(p.createdAt) < start) continue;
    const e = byKey.get(p.key) || { key: p.key, todayTotal: 0, firstAt: p.createdAt };
    e.todayTotal += p.amount;
    if (p.createdAt < e.firstAt) e.firstAt = p.createdAt;
    byKey.set(p.key, e);
  }
  return [...byKey.values()]
    .map((e) => ({ ...e, listing: data.listings.find((l) => l.key === e.key) || null }))
    .filter((e) => e.listing)
    .sort((a, b) => b.todayTotal - a.todayTotal || new Date(a.firstAt) - new Date(b.firstAt))
    .map((e, i) => ({
      key: e.key,
      title: e.listing.title,
      url: e.listing.url,
      kind: e.listing.kind,
      todayTotal: e.todayTotal,
      rank: i + 1,
    }));
}

export function summarise(data) {
  const live = data.payments.filter((p) => p.mode === "live");
  const demo = data.payments.filter((p) => p.mode === "demo");
  const sum = (arr) => arr.reduce((a, p) => a + p.amount, 0);
  const top = data.listings.length ? Math.max(...data.listings.map((l) => l.total)) : 0;
  return {
    totalRevenue: sum(live), // real, settled money only — demo payments are NEVER in here
    livePayments: live.length,
    demoRevenue: sum(demo),
    demoPayments: demo.length,
    totalBids: live.length + demo.length,
    listings: data.listings.length,
    visitors: data.stats.visitors,
    topBid: top,
  };
}
