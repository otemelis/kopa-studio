import { createAdminClient } from "@/lib/supabase/admin";

export type AppleAdsConnectionRow = { id: string; appleAdsOrgId: string; appleAdsOrgName: string; currency: string | null; timezone: string | null; permissionMode: "read_only" | "read_write"; status: string; lastApiSuccessAt: string | null; lastTokenSuccessAt: string | null };
export type AppleAdsAppMappingRow = { id: string; connectionId: string; appId: string; adamId: string; appleAppName: string | null; mappingStatus: string; appName: string | null };

function mapConnection(row: Record<string, unknown>): AppleAdsConnectionRow {
  return { id: String(row.id), appleAdsOrgId: String(row.apple_ads_org_id), appleAdsOrgName: String(row.apple_ads_org_name), currency: typeof row.currency === "string" ? row.currency : null, timezone: typeof row.timezone === "string" ? row.timezone : null, permissionMode: row.permission_mode === "read_write" ? "read_write" : "read_only", status: String(row.status), lastApiSuccessAt: typeof row.last_api_success_at === "string" ? row.last_api_success_at : null, lastTokenSuccessAt: typeof row.last_token_success_at === "string" ? row.last_token_success_at : null };
}

export async function listAppleAdsConnections(ownerUserId: string): Promise<AppleAdsConnectionRow[]> {
  const { data, error } = await createAdminClient().from("apple_ads_connections").select("id,apple_ads_org_id,apple_ads_org_name,currency,timezone,permission_mode,status,last_api_success_at,last_token_success_at").eq("owner_user_id", ownerUserId).order("created_at", { ascending: false });
  if (error) throw new Error("Could not read Apple Ads connections.");
  return (data ?? []).map(mapConnection);
}

export async function saveAppleAdsConnection(ownerUserId: string, input: { appleAdsOrgId: string; appleAdsOrgName: string; currency?: string; timezone?: string }): Promise<AppleAdsConnectionRow> {
  const { data, error } = await createAdminClient().from("apple_ads_connections").upsert({ owner_user_id: ownerUserId, apple_ads_org_id: input.appleAdsOrgId, apple_ads_org_name: input.appleAdsOrgName, currency: input.currency ?? null, timezone: input.timezone ?? null, permission_mode: "read_only", credential_reference: "environment", status: "healthy", last_token_success_at: new Date().toISOString(), last_api_success_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "owner_user_id,apple_ads_org_id" }).select("id,apple_ads_org_id,apple_ads_org_name,currency,timezone,permission_mode,status,last_api_success_at,last_token_success_at").single();
  if (error) throw new Error("Could not save the Apple Ads connection.");
  return mapConnection(data);
}

export async function listAppleAdsAppMappings(ownerUserId: string): Promise<AppleAdsAppMappingRow[]> {
  const db = createAdminClient();
  const { data: connections, error: connectionError } = await db.from("apple_ads_connections").select("id").eq("owner_user_id", ownerUserId);
  if (connectionError) throw new Error("Could not read Apple Ads connections.");
  const ids = (connections ?? []).map((connection) => connection.id);
  if (!ids.length) return [];
  const { data, error } = await db.from("apple_ads_app_mappings").select("id,connection_id,app_id,adam_id,apple_app_name,mapping_status").in("connection_id", ids).order("created_at", { ascending: false });
  if (error) throw new Error("Could not read Apple Ads app mappings.");
  const appIds = [...new Set((data ?? []).map((row) => row.app_id))];
  const { data: apps, error: appError } = appIds.length ? await db.from("aso_apps").select("id,name").in("id", appIds) : { data: [], error: null };
  if (appError) throw new Error("Could not resolve mapped apps.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));
  return (data ?? []).map((row) => ({ id: row.id, connectionId: row.connection_id, appId: row.app_id, adamId: row.adam_id, appleAppName: row.apple_app_name, mappingStatus: row.mapping_status, appName: names.get(row.app_id) ?? null }));
}

export async function saveAppleAdsAppMapping(ownerUserId: string, input: { connectionId: string; appId: string; adamId: string; appleAppName?: string }): Promise<void> {
  const db = createAdminClient();
  const { data: connection, error: connectionError } = await db.from("apple_ads_connections").select("id").eq("id", input.connectionId).eq("owner_user_id", ownerUserId).maybeSingle();
  if (connectionError || !connection) throw new Error("Apple Ads connection was not found.");
  const { error } = await db.from("apple_ads_app_mappings").upsert({ connection_id: input.connectionId, app_id: input.appId, adam_id: input.adamId, apple_app_name: input.appleAppName ?? null, mapping_status: "confirmed", mapped_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "connection_id,adam_id" });
  if (error) throw new Error(error.code === "23505" ? "That Kopa app is already mapped to a different Apple Ads app for this connection." : "Could not save the app mapping.");
}
