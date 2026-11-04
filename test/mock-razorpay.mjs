// Minimal mock of the Razorpay API for local end-to-end tests of the adapter.
// Implements just what lib/razorpay.js calls: POST /v1/orders, GET /v1/orders/:id,
// GET /v1/payments/:id. Creating an order also creates a captured payment for it
// (as if the buyer completed Checkout). Run: node test/mock-razorpay.mjs (port 4100).
import http from "http";

const orders = new Map();
const payments = new Map();
let n = 0;

const server = http.createServer((req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    if (req.method === "POST" && url.pathname === "/v1/orders") {
      const b = JSON.parse(body || "{}");
      n += 1;
      const order = {
        id: `order_mock_${n}`,
        amount: b.amount,
        currency: b.currency,
        receipt: b.receipt,
        notes: b.notes,
        status: "paid",
        payment_id: `pay_mock_${n}`, // test-only convenience so the harness can act as the buyer
      };
      orders.set(order.id, order);
      payments.set(order.payment_id, {
        id: order.payment_id,
        order_id: order.id,
        amount: b.amount,
        currency: b.currency,
        status: "captured",
      });
      return send(200, order);
    }
    const om = url.pathname.match(/^\/v1\/orders\/(.+)$/);
    if (req.method === "GET" && om && orders.has(om[1])) return send(200, orders.get(om[1]));
    const pm = url.pathname.match(/^\/v1\/payments\/(.+)$/);
    if (req.method === "GET" && pm && payments.has(pm[1])) return send(200, payments.get(pm[1]));
    return send(404, { error: { description: "not found in mock" } });
  });
});

const port = Number(process.env.MOCK_PORT || 4100);
server.listen(port, () => console.log(`mock razorpay on :${port}`));
