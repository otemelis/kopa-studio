import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAppleAdsCampaigns } from "@/services/apple-ads-campaign-sync-service";

function authorized(request: Request) { const secret = process.env.APPLE_ADS_SYNC_SECRET; return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`; }
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = createAdminClient(); const { data: run, error } = await db.from("apple_ads_sync_runs").select("id,connection_id").eq("status", "queued").eq("resource_type", "campaigns").order("created_at").limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not claim Apple Ads sync." }, { status: 500 });
  if (!run) return NextResponse.json({ status: "idle" });
  const { data: claimed } = await db.from("apple_ads_sync_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", run.id).eq("status", "queued").select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ status: "claimed_elsewhere" });
  const { data: connection } = await db.from("apple_ads_connections").select("apple_ads_org_id").eq("id", run.connection_id).single();
  try { const result = await syncAppleAdsCampaigns(run.connection_id, String(connection?.apple_ads_org_id)); await db.from("apple_ads_sync_runs").update({ status: "completed", rows_inserted: result.campaigns, completed_at: new Date().toISOString() }).eq("id", run.id); return NextResponse.json({ status: "completed", ...result }); }
  catch (cause) { const message = cause instanceof Error ? cause.message : "Campaign sync failed."; await db.from("apple_ads_sync_runs").update({ status: "failed", error_message: message, completed_at: new Date().toISOString() }).eq("id", run.id); return NextResponse.json({ error: message }, { status: 500 }); }
}
