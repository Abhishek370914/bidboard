import { NextResponse } from "next/server";
import { recordVisit } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const visitors = await recordVisit();
  return NextResponse.json({ visitors });
}
