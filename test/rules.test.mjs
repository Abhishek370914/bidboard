import test from "node:test";
import assert from "node:assert/strict";
import { validatePayment, rankListings, normaliseTarget, RULES } from "../lib/rules.js";

const board = [
  { key: "url:https://a.com/", total: 100, createdAt: "2026-08-19T00:00:00Z" },
  { key: "url:https://b.com/", total: 50, createdAt: "2026-08-19T01:00:00Z" },
];

test("new listing below the $10 minimum is rejected", () => {
  const r = validatePayment({ listings: board, key: "url:https://c.com/", addUsd: 9 });
  assert.equal(r.ok, false);
  assert.equal(r.minCharge, RULES.MIN_ENTRY_USD);
});

test("new listing at $10 is accepted when it does not take #1", () => {
  const r = validatePayment({ listings: board, key: "url:https://c.com/", addUsd: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.resultingTotal, 10);
});

test("cents are rejected — whole dollars only", () => {
  const r = validatePayment({ listings: board, key: "url:https://c.com/", addUsd: 10.5 });
  assert.equal(r.ok, false);
});

test("today board: taking today's #1 also needs the leader + $5", () => {
  const todayTotals = { "url:https://a.com/": 5, "url:https://b.com/": 50 };
  const tooLow = validatePayment({ listings: board, key: "url:https://c.com/", addUsd: 53, todayTotals });
  assert.equal(tooLow.ok, false);
  assert.equal(tooLow.minCharge, 55);
  const ok = validatePayment({ listings: board, key: "url:https://c.com/", addUsd: 55, todayTotals });
  assert.equal(ok.ok, true);
});

test("taking #1 requires beating the leader by at least $5 (new listing)", () => {
  const tooLow = validatePayment({ listings: board, key: "url:https://c.com/", addUsd: 103 });
  assert.equal(tooLow.ok, false);
  assert.equal(tooLow.minCharge, 105);
  const ok = validatePayment({ listings: board, key: "url:https://c.com/", addUsd: 105 });
  assert.equal(ok.ok, true);
});

test("top-up pays only the difference and #1 rule uses the resulting total", () => {
  const b = validatePayment({ listings: board, key: "url:https://b.com/", addUsd: 54 }); // 50+54=104 < 105
  assert.equal(b.ok, false);
  assert.equal(b.minCharge, 55);
  const ok = validatePayment({ listings: board, key: "url:https://b.com/", addUsd: 55 }); // =105
  assert.equal(ok.ok, true);
  assert.equal(ok.resultingTotal, 105);
});

test("leader topping up itself is not blocked by the #1 gap", () => {
  const r = validatePayment({ listings: board, key: "url:https://a.com/", addUsd: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.resultingTotal, 101);
});

test("cap is enforced", () => {
  const big = [{ key: "url:https://a.com/", total: 999999, createdAt: "2026-08-19T00:00:00Z" }];
  const r = validatePayment({ listings: big, key: "url:https://a.com/", addUsd: 1 });
  assert.equal(r.ok, false);
});

test("ties rank the older listing first", () => {
  const tied = [
    { key: "newer", total: 10, createdAt: "2026-08-20T00:00:00Z" },
    { key: "older", total: 10, createdAt: "2026-08-19T00:00:00Z" },
  ];
  assert.equal(rankListings(tied)[0].key, "older");
});

test("normaliseTarget handles sites and handles", () => {
  assert.equal(normaliseTarget("example.com").url, "https://example.com/");
  assert.equal(normaliseTarget("@some_user").url, "https://x.com/some_user");
  assert.equal(normaliseTarget("not a url"), null);
  assert.equal(normaliseTarget(""), null);
});
