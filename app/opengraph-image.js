import { ImageResponse } from "next/og";

export const alt = "BidBoard — Pay to be #1";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0c1e",
          color: "#f3e9da",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 8, color: "#f2a03a" }}>BIDBOARD</div>
        <div style={{ fontSize: 110, fontWeight: 800, marginTop: 16 }}>Pay to be #1.</div>
        <div style={{ fontSize: 36, color: "#a7a9c9", marginTop: 20 }}>
          Rank is the bid. Nothing else. No ads. No accounts.
        </div>
        <div style={{ fontSize: 30, color: "#f2a03a", marginTop: 36 }}>First $10 takes the crown 👑</div>
      </div>
    ),
    { ...size }
  );
}
