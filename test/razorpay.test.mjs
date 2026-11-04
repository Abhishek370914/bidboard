import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { verifyPaymentSignature, verifyWebhookSignature, chargeAmountMinor } from "../lib/razorpay.js";

const SECRET = "test_key_secret";
const WH_SECRET = "test_webhook_secret";

test("payment signature: valid HMAC over order_id|payment_id passes", () => {
  const sig = createHmac("sha256", SECRET).update("order_ABC|pay_XYZ").digest("hex");
  assert.equal(verifyPaymentSignature("order_ABC", "pay_XYZ", sig, SECRET), true);
});

test("payment signature: tampered ids or wrong secret fail", () => {
  const sig = createHmac("sha256", SECRET).update("order_ABC|pay_XYZ").digest("hex");
  assert.equal(verifyPaymentSignature("order_ABC", "pay_EVIL", sig, SECRET), false);
  assert.equal(verifyPaymentSignature("order_ABC", "pay_XYZ", sig, "wrong_secret"), false);
  assert.equal(verifyPaymentSignature("order_ABC", "pay_XYZ", "", SECRET), false);
  assert.equal(verifyPaymentSignature("order_ABC", "pay_XYZ", sig, ""), false);
});

test("webhook signature: HMAC over the exact raw body", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
  const sig = createHmac("sha256", WH_SECRET).update(body).digest("hex");
  assert.equal(verifyWebhookSignature(body, sig, WH_SECRET), true);
  // Same JSON, re-serialised with different spacing, must FAIL (raw-body rule).
  assert.equal(verifyWebhookSignature(body.replace(":", " : "), sig, WH_SECRET), false);
  // Payment secret must not verify webhooks and vice versa.
  assert.equal(verifyWebhookSignature(body, sig, SECRET), false);
});

test("charge amounts: USD passes through in cents; INR converts by the configured rate", () => {
  const prevC = process.env.RAZORPAY_CURRENCY;
  const prevR = process.env.USD_INR_RATE;
  try {
    delete process.env.RAZORPAY_CURRENCY;
    delete process.env.USD_INR_RATE;
    assert.deepEqual(chargeAmountMinor(10), { amount: 1000, currency: "USD" });
    process.env.RAZORPAY_CURRENCY = "INR";
    process.env.USD_INR_RATE = "84";
    assert.deepEqual(chargeAmountMinor(10), { amount: 84000, currency: "INR" });
    delete process.env.USD_INR_RATE;
    assert.throws(() => chargeAmountMinor(10), /USD_INR_RATE/);
  } finally {
    if (prevC === undefined) delete process.env.RAZORPAY_CURRENCY; else process.env.RAZORPAY_CURRENCY = prevC;
    if (prevR === undefined) delete process.env.USD_INR_RATE; else process.env.USD_INR_RATE = prevR;
  }
});
