// End-to-end driver for the Razorpay adapter against the mock API.
// Prereqs: mock on :4100 and the app on :3100 started with
//   RAZORPAY_KEY_ID=rzp_test_mock RAZORPAY_KEY_SECRET=mocksecret
//   RAZORPAY_WEBHOOK_SECRET=mockwhsec RAZORPAY_API_BASE=http://localhost:4100/v1
// Run: node test/e2e-razorpay.mjs
import { createHmac } from "crypto";
import assert from "node:assert/strict";

const APP = "http://localhost:3100";
const MOCK = "http://localhost:4100";
const KEY_SECRET = "mocksecret";
const WH_SECRET = "mockwhsec";
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const post = (url, obj, headers = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof obj === "string" ? obj : JSON.stringify(obj) }).then(j);

// 1. Checkout creates a Razorpay order (bid NOT credited yet)
const co = await post(`${APP}/api/checkout`, { target: "https://razor-startup.example.com", addUsd: 10 });
assert.equal(co.body.mode, "razorpay", JSON.stringify(co.body));
assert.ok(co.body.orderId.startsWith("order_mock_"));
assert.equal(co.body.amount, 1000);
assert.equal(co.body.currency, "USD");
let listings = await (await fetch(`${APP}/api/listings`)).json();
assert.equal(listings.listings.length, 0, "order creation must not credit the bid");
console.log("1. order created, bid not credited yet ✓");

// 2. Buyer pays; browser calls verify with a genuine signature
const order = await (await fetch(`${MOCK}/v1/orders/${co.body.orderId}`)).json();
const payId = order.payment_id;
const sig = createHmac("sha256", KEY_SECRET).update(`${co.body.orderId}|${payId}`).digest("hex");
const bad = await post(`${APP}/api/checkout/razorpay/verify`, { razorpay_order_id: co.body.orderId, razorpay_payment_id: payId, razorpay_signature: "deadbeef" });
assert.equal(bad.status, 400, "forged signature must be rejected");
const ver = await post(`${APP}/api/checkout/razorpay/verify`, { razorpay_order_id: co.body.orderId, razorpay_payment_id: payId, razorpay_signature: sig });
assert.equal(ver.body.ok, true, JSON.stringify(ver.body));
assert.equal(ver.body.applied, true);
assert.equal(ver.body.total, 10);
console.log("2. forged signature rejected; genuine verify credited $10 ✓");

// 3. Revenue now counts the live payment
let rev = await (await fetch(`${APP}/api/revenue`)).json();
assert.equal(rev.payments_provider, "razorpay");
assert.equal(rev.demo_mode, false);
assert.equal(rev.total_revenue_usd, 10);
console.log("3. /api/revenue shows $10 live via razorpay ✓");

// 4. Webhook for a second order settles it; replaying the same verify is a no-op
const co2 = await post(`${APP}/api/checkout`, { target: "@second_founder", addUsd: 20 });
const order2 = await (await fetch(`${MOCK}/v1/orders/${co2.body.orderId}`)).json();
const whBody = JSON.stringify({
  event: "payment.captured",
  payload: { payment: { entity: { id: order2.payment_id, order_id: co2.body.orderId, amount: order2.amount, status: "captured" } } },
});
const whSig = createHmac("sha256", WH_SECRET).update(whBody).digest("hex");
const badWh = await post(`${APP}/api/webhook/razorpay`, whBody, { "x-razorpay-signature": "nope" });
assert.equal(badWh.status, 400, "bad webhook signature must be rejected");
const wh = await post(`${APP}/api/webhook/razorpay`, whBody, { "x-razorpay-signature": whSig });
assert.equal(wh.body.received, true);
const dup = await post(`${APP}/api/checkout/razorpay/verify`, {
  razorpay_order_id: co.body.orderId,
  razorpay_payment_id: payId,
  razorpay_signature: sig,
});
assert.equal(dup.body.applied, false, "duplicate payment must not double-credit");
listings = await (await fetch(`${APP}/api/listings`)).json();
assert.deepEqual(
  listings.listings.map((l) => [l.title, l.total]),
  [["@second_founder", 20], ["razor-startup.example.com", 10]]
);
rev = await (await fetch(`${APP}/api/revenue`)).json();
assert.equal(rev.total_revenue_usd, 30);
console.log("4. webhook settled $20, duplicates blocked, board + revenue correct ✓");
console.log("E2E RAZORPAY: ALL PASS");
