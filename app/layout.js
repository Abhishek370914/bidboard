import "./globals.css";

export const metadata = {
  title: "BidBoard — Pay to be #1",
  description: "A pay-to-rank leaderboard. Rank is the bid, nothing else. No ads, no accounts, no revenue share.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
