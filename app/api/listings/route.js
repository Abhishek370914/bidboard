import { NextResponse } from "next/server";
import { getState, summarise, rankToday } from "../../../lib/store";
import { rankListings } from "../../../lib/rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getState();
  const ranked = rankListings(data.listings).map((l, i) => ({ ...l, rank: i + 1 }));
  return NextResponse.json({ listings: ranked, today: rankToday(data), summary: summarise(data) });
}
