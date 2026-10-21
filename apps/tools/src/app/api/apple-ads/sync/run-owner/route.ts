import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAppleAdsCampaigns } from "@/services/apple-ads-campaign-sync-service";

export async function POST() {
  await requireOwner(); const db = createAdminClient(); const { data: run } = await db.from("apple_ads_sync_runs").select("id,connection_id").eq("status", "queued").eq("resource_type", "campaigns").order("created_at").limit(1).maybeSingle();
  if (!run) return NextResponse.json({ error: "No queued campaign sync found." }, { status: 404 });
  const { data: claimed } = await db.from("apple_ads_sync_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", run.id).eq("status", "queued").select("id").maybeSingle();
  if (!claimed) return NextResponse.json({ error: "The sync was already claimed." }, { status: 409 });
  const { data: connection } = await db.from("apple_ads_connections").select("apple_ads_org_id").eq("id", run.connection_id).single();
  try { const result = await syncAppleAdsCampaigns(run.connection_id, String(connection?.apple_ads_org_id)); await db.from("apple_ads_sync_runs").update({ status: "completed", rows_inserted: result.campaigns, completed_at: new Date().toISOString() }).eq("id", run.id); return NextResponse.json({ status: "completed", ...result }); }
  catch (cause) { const message = cause instanceof Error ? cause.message : "Campaign sync failed."; await db.from("apple_ads_sync_runs").update({ status: "failed", error_message: message, completed_at: new Date().toISOString() }).eq("id", run.id); return NextResponse.json({ error: message }, { status: 500 }); }
}
