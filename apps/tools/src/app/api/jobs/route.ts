import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobRequestSchema } from "@/validators/api";
import { rankingCollectorUrl } from "./collector-url";

async function wakeCollector(jobId: string, db: ReturnType<typeof createAdminClient>) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    await db.from("aso_jobs").update({ status: "queued", started_at: null }).eq("id", jobId);
    return { state: "queued", message: "Queued. Immediate worker wake is not configured for Tools." };
  }
  after(async () => {
    let errorMessage: string | null = null;
    let syncRunId: string | null = null;
    try {
      const response = await fetch(rankingCollectorUrl(process.env.ASO_COLLECTOR_URL), { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" });
      const body = await response.json().catch(() => null);
      syncRunId = typeof body?.runId === "string" ? body.runId : null;
      if (!response.ok || !body?.ok) errorMessage = body?.error ?? body?.message ?? "The rankings collector did not complete.";
    } catch {
      errorMessage = "The rankings collector could not be reached.";
    }
    await db.from("aso_jobs").update({
      status: errorMessage ? "failed" : "completed",
      progress: 100,
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      sync_run_id: syncRunId,
    }).eq("id", jobId);
  });
  return { state: "started", message: "A bounded ranking collection is starting. Refresh Jobs for its result." };
}

export async function POST(request: Request) {
  await requireOwner();
  const parsed = jobRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.type !== "collection") return NextResponse.json({ error: "Invalid job request." }, { status: 400 });
  const db = createAdminClient();
  const activeQuery = db.from("aso_jobs").select("id,status,created_at,started_at").eq("job_type", "collection").in("status", ["queued", "running"]).is("app_id", null).is("country", null).order("created_at").limit(1).maybeSingle();
  const { data: active, error: activeError } = await activeQuery;
  if (activeError) return NextResponse.json({ error: "Could not inspect the collection queue." }, { status: 500 });
  if (active?.status === "running") {
    const startedAt = active.started_at ?? active.created_at;
    const stale = Date.now() - Date.parse(startedAt) > 6 * 60_000;
    if (!stale) return NextResponse.json({ error: "Keyword ranking scrape is already running.", active }, { status: 409 });
    await db.from("aso_jobs").update({ status: "failed", progress: 100, completed_at: new Date().toISOString(), error_message: "Collection job exceeded its six-minute lease; recovered by a new request." }).eq("id", active.id);
  }
  if (active?.status === "queued") {
    const { error } = await db.from("aso_jobs").update({ status: "running", started_at: new Date().toISOString(), error_message: null }).eq("id", active.id);
    if (error) return NextResponse.json({ error: "Could not start the queued collection." }, { status: 500 });
    const wake = await wakeCollector(active.id, db);
    return NextResponse.json({ data: active, wake, message: `Keyword ranking scrape was queued. ${wake.message}` }, { status: 202 });
  }

  const { data, error } = await db.from("aso_jobs").insert({ job_type: "collection", app_id: parsed.data.appId ?? null, country: parsed.data.country ?? null, trigger_source: "tools" }).select("id,status,created_at,started_at").single();
  if (error?.code === "23505") return NextResponse.json({ error: "An equivalent collection job is already queued or running. Refresh Jobs to see the active queue row." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Could not queue collection." }, { status: 500 });
  const { error: startError } = await db.from("aso_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", data.id);
  if (startError) return NextResponse.json({ error: "The job was queued but could not be started." }, { status: 500 });
  const wake = await wakeCollector(data.id, db);
  return NextResponse.json({ data, wake, message: `Keyword ranking scrape queued. ${wake.message}` }, { status: 202 });
}
