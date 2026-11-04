"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US")}`;

export default function Home() {
  const [listings, setListings] = useState([]);
  const [today, setToday] = useState([]);
  const [summary, setSummary] = useState(null);
  const [target, setTarget] = useState("");
  const [addUsd, setAddUsd] = useState(10);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const visited = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/listings", { cache: "no-store" });
    const j = await r.json();
    setListings(j.listings);
    setToday(j.today || []);
    setSummary(j.summary);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // live board
    if (!visited.current && !sessionStorage.getItem("bb-visited")) {
      visited.current = true;
      sessionStorage.setItem("bb-visited", "1");
      fetch("/api/visit", { method: "POST" }).then(load).catch(() => {});
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get("paid")) setMsg("Payment received — the board updates as soon as Stripe confirms it (a few seconds).");
    if (q.get("cancelled")) setMsg("Checkout cancelled — nothing was charged.");
    return () => clearInterval(t);
  }, [load]);

  const leader = listings[0];
  const takeFirstCost = leader ? leader.total + 5 : 10;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, addUsd: Number(addUsd) }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "Something went wrong.");
        if (j.minCharge) setAddUsd(j.minCharge);
        return;
      }
      if (j.mode === "live" && j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
        return;
      }
      if (j.mode === "razorpay") {
        await openRazorpay(j);
        return;
      }
      setMsg(`Demo bid applied — this listing now totals ${fmt(j.resultingTotal)}. No real money moved (demo mode).`);
      await load();
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openRazorpay(order) {
    try {
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "BidBoard",
        description: `Listing bid — ${order.targetTitle}. Rank is the bid, nothing else. Non-refundable.`,
        theme: { color: "#f2a03a" },
        modal: {
          ondismiss: () => setMsg("Payment window closed — nothing was charged."),
        },
        handler: async (resp) => {
          setMsg("Payment done — verifying with the server…");
          const vr = await fetch("/api/checkout/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resp),
          });
          const vj = await vr.json().catch(() => ({}));
          if (vr.ok) {
            setMsg(`Verified — your listing total is now ${fmt(vj.total)}.`);
          } else {
            setMsg(`Payment taken but verification is pending (${vj.error || "unknown"}). If money left your account, it is confirmed by webhook within a minute — do not pay again.`);
          }
          await load();
        },
      });
      rzp.open();
    } catch {
      setMsg("Could not open the payment window — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function clickListing(l) {
    try {
      await fetch("/api/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: l.key }),
      });
    } catch {}
    window.open(l.url, "_blank", "noopener");
    load();
  }

  return (
    <main>
      <header className="hero">
        <p className="kicker">BIDBOARD — PAY TO RANK</p>
        <h1>Pay to be #1.</h1>
        <p className="sub">
          One board. No algorithm, no ads, no accounts, no revenue share.
          Rank is the bid — nothing else. Outbid the leader and the top spot is yours.
        </p>
        {summary && <DemoBanner summary={summary} />}
        <div className="stats">
          <div><span>{summary ? fmt(summary.totalRevenue) : "—"}</span><label>total revenue (live payments only)</label></div>
          <div><span>{summary ? summary.visitors.toLocaleString("en-US") : "—"}</span><label>visitors</label></div>
          <div><span>{summary ? fmt(summary.topBid) : "—"}</span><label>top bid</label></div>
          <div><span>{summary ? summary.totalBids : "—"}</span><label>bids placed</label></div>
        </div>
      </header>

      <section className="bidbox">
        <h2>List your product or X handle</h2>
        <form onSubmit={submit}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://yourproduct.com  or  @yourhandle"
            required
          />
          <div className="amountrow">
            <label>
              Pay now (USD, whole dollars)
              <input
                type="number"
                min="1"
                step="1"
                value={addUsd}
                onChange={(e) => setAddUsd(e.target.value)}
                required
              />
            </label>
            <button type="button" className="ghost" onClick={() => setAddUsd(takeFirstCost)}>
              Take #1 — {fmt(takeFirstCost)}
            </button>
            <button type="submit" disabled={busy}>{busy ? "Working…" : "Bid"}</button>
          </div>
          <p className="paynote">
            Payments via UPI &amp; Indian netbanking (Razorpay).<br />
            Your link stays on the board — rank = total paid.
          </p>
        </form>
        {msg && <p className="msg">{msg}</p>}
        <ul className="rules">
          <li>New listings start at $10. Topping up an existing listing: pay only the difference, $1 minimum.</li>
          <li>Rank = your cumulative total. To take #1 — all-time or on today's board — you must beat the current #1 by at least $5.</li>
          <li>Ties go to the older listing. Totals are capped at $999,999. Payments are non-refundable.</li>
        </ul>
      </section>

      <section>
        <h2>The board</h2>
        {listings.length === 0 && <p className="empty">No listings yet. The first $10 takes #1.</p>}
        <table className="board">
          <thead>
            <tr><th>#</th><th>Listing</th><th>Total bid</th><th>Clicks</th><th></th></tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.key} className={l.rank === 1 ? "first" : ""}>
                <td>{l.rank}</td>
                <td>
                  <button className="link" onClick={() => clickListing(l)}>{l.title}</button>
                  {l.rank === 1 && <span className="crown"> 👑</span>}
                </td>
                <td>{fmt(l.total)}</td>
                <td>{l.clicks}</td>
                <td>
                  <button
                    className="ghost small"
                    onClick={() => { setTarget(l.url); setAddUsd(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  >
                    Top up
                  </button>{" "}
                  <a
                    className="sharelink"
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      `${l.title} is #${l.rank} on BidBoard at ${fmt(l.total)} — outbid them by $5 to take the spot 👑`
                    )}&url=${encodeURIComponent("https://bidboard-tau.vercel.app")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Share on X
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Today's board <span className="sub">(resets midnight UTC)</span></h2>
        {today.length === 0 && <p className="empty">Nothing spent today yet.</p>}
        {today.length > 0 && (
          <table className="board">
            <thead>
              <tr><th>#</th><th>Listing</th><th>Spent today</th></tr>
            </thead>
            <tbody>
              {today.map((l) => (
                <tr key={l.key} className={l.rank === 1 ? "first" : ""}>
                  <td>{l.rank}</td>
                  <td>{l.title}</td>
                  <td>{fmt(l.todayTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer>
        <p>Built as an original implementation of the public pay-to-rank mechanic. Revenue on this page counts settled live payments only — see <a href="/api/revenue">/api/revenue</a>.</p>
      </footer>
    </main>
  );
}

function DemoBanner({ summary }) {
  // The revenue endpoint is the source of truth for whether payments are live.
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    fetch("/api/revenue").then((r) => r.json()).then((j) => setDemo(!!j.demo_mode)).catch(() => {});
  }, []);
  if (!demo) return null;
  return (
    <p className="demo">
      DEMO MODE — no payment provider is connected, so bids are simulated and{" "}
      <strong>never counted as revenue</strong> (demo bids so far: {summary.demoPayments}, {fmt(summary.demoRevenue)} simulated).
      Add Razorpay (or Stripe) keys to take real money.
    </p>
  );
}
