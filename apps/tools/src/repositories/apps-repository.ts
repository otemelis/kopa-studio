import { createAdminClient } from "@/lib/supabase/admin";
import type { AsoApp } from "@/types/domain";

const APP_FIELDS = "id,name,platform,store_app_id,bundle_id,primary_country,category,rating,rating_count,updated_at,last_store_update_at";

function mapApp(row: Record<string, unknown>): AsoApp {
  return {
    id: String(row.id), name: String(row.name), platform: row.platform === "android" ? "android" : "ios",
    storeAppId: String(row.store_app_id), bundleId: typeof row.bundle_id === "string" ? row.bundle_id : null,
    primaryCountry: String(row.primary_country), category: typeof row.category === "string" ? row.category : null,
    rating: typeof row.rating === "number" ? row.rating : row.rating ? Number(row.rating) : null,
    ratingCount: typeof row.rating_count === "number" ? row.rating_count : null,
    updatedAt: String(row.updated_at), lastStoreUpdateAt: typeof row.last_store_update_at === "string" ? row.last_store_update_at : null,
  };
}

export async function listApps(): Promise<AsoApp[]> {
  const { data, error } = await createAdminClient().from("aso_apps").select(APP_FIELDS).order("name").limit(100);
  if (error) throw new Error("Could not read app records.");
  return (data ?? []).map(mapApp);
}

export async function getApp(id: string): Promise<AsoApp | null> {
  const { data, error } = await createAdminClient().from("aso_apps").select(APP_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not read app record.");
  return data ? mapApp(data) : null;
}
