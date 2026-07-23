import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobRequestSchema } from "@/validators/api";

const collectorUrl = () => process.env.ASO_COLLECTOR_URL ?? "https://www.kopa.studio/api/aso/collect";

async function wakeCollector() {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { state: "queued", message: "Queued. Immediate worker wake is not configured for Tools." };
  const response = await fetch(collectorUrl(), { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) return { state: "failed", message: body?.error ?? body?.message ?? "The collector did not accept the queued job." };
  return { state: "started", message: body?.message ?? "Collector started." };
}

export async function POST(request: Request) {
  await requireOwner();
  const parsed = jobRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.type !== "collection") return NextResponse.json({ error: "Invalid job request." }, { status: 400 });
  const db = createAdminClient();
  const activeQuery = db.from("aso_jobs").select("id,status,created_at,started_at").eq("job_type", "collection").in("status", ["queued", "running"]).is("app_id", null).is("country", null).order("created_at").limit(1).maybeSingle();
  const { data: active, error: activeError } = await activeQuery;
  if (activeError) return NextResponse.json({ error: "Could not inspect the collection queue." }, { status: 500 });
  if (active?.status === "running") return NextResponse.json({ error: "Keyword ranking scrape is already running.", active }, { status: 409 });
  if (active?.status === "queued") {
    const wake = await wakeCollector();
    return NextResponse.json({ data: active, wake, message: `Keyword ranking scrape was already queued. ${wake.message}` }, { status: wake.state === "failed" ? 502 : 200 });
  }

  const { data, error } = await db.from("aso_jobs").insert({ job_type: "collection", app_id: parsed.data.appId ?? null, country: parsed.data.country ?? null, trigger_source: "tools" }).select("id,status,created_at,started_at").single();
  if (error?.code === "23505") return NextResponse.json({ error: "An equivalent collection job is already queued or running. Refresh Jobs to see the active queue row." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Could not queue collection." }, { status: 500 });
  const wake = await wakeCollector();
  return NextResponse.json({ data, wake, message: `Keyword ranking scrape queued. ${wake.message}` }, { status: wake.state === "failed" ? 502 : 201 });
}
