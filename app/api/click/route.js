import { NextResponse } from "next/server";
import { recordClick } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body?.key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const listing = await recordClick(body.key);
  if (!listing) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ clicks: listing.clicks });
}
