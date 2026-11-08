import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { refreshApplePopularity } from "@/lib/aso/apple-popularity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner-initiated, bounded refresh. Reads Apple Ads; writes only Kopa reporting rows. */
export async function POST(request: Request) {
  await requireOwner();
  if (process.env.VERCEL_ENV === "preview") return NextResponse.json({ error: "Preview refresh is disabled to protect production reporting data." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  let input: { appId?: string; country?: string; weekStart?: string };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!input.appId || !input.country) return NextResponse.json({ error: "appId and country are required." }, { status: 400 });
  try {
    return NextResponse.json(await refreshApplePopularity(input.appId, input.country, input.weekStart));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Popularity refresh failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
