import { createAdminClient } from "@/lib/supabase/admin";
import type { StorefrontRow } from "@/types/domain";

export async function listStorefronts(appId?: string): Promise<StorefrontRow[]> {
  const db = createAdminClient();
  let query = db.from("aso_app_storefronts").select("id,app_id,country,is_primary,metadata_localised,screenshots_localised,notes").order("country").limit(200);
  if (appId) query = query.eq("app_id", appId);
  const { data, error } = await query;
  if (error) throw new Error("Could not read storefront coverage.");
  if (!data?.length) return [];
  const { data: apps, error: appsError } = await db.from("aso_apps").select("id,name").in("id", [...new Set(data.map((row) => row.app_id))]);
  if (appsError) throw new Error("Could not resolve storefront apps.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));
  return data.map((row) => ({ id: row.id, appName: names.get(row.app_id) ?? "Unknown app", country: row.country, isPrimary: row.is_primary, metadataLocalised: row.metadata_localised, screenshotsLocalised: row.screenshots_localised, notes: row.notes }));
}
