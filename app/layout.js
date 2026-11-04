import "./globals.css";

export const metadata = {
  title: "BidBoard — Pay to be #1",
  description: "A pay-to-rank leaderboard. Rank is the bid, nothing else. No ads, no accounts, no revenue share.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://bidboard-tau.vercel.app"),
  openGraph: {
    title: "BidBoard — Pay to be #1",
    description: "Rank is the bid, nothing else. Outbid the leader by $5 and #1 is yours.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BidBoard — Pay to be #1",
    description: "Rank is the bid, nothing else. Outbid the leader by $5 and #1 is yours.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
