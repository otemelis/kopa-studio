import { NextResponse } from "next/server";
import { refreshPendingApplePopularity } from "@/lib/aso/apple-popularity-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "Scheduled refresh is production-only." }, { status: 403 });
  try {
    const result = await refreshPendingApplePopularity();
    console.info("Apple demand weekly refresh", JSON.stringify({ weekStart: result.weekStart, selected: result.selected, completed: result.completed, remaining: result.remaining, failures: result.failures.length }));
    return NextResponse.json(result, { status: result.failures.length ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Apple demand weekly refresh failed", error instanceof Error ? error.message : "Unknown failure");
    return NextResponse.json({ error: "Scheduled Apple demand refresh failed." }, { status: 503 });
  }
}
