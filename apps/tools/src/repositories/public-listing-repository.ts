export type PublicListing = {
  storeAppId: string;
  country: string;
  checkedAt: string;
  name: string;
  description: string | null;
  screenshots: string[];
  storeUrl: string | null;
  version: string | null;
};

export async function getPublicListing(storeAppId: string, country: string): Promise<PublicListing | null> {
  if (!/^\d+$/.test(storeAppId) || !/^[a-z]{2}$/i.test(country)) return null;
  const url = new URL("https://itunes.apple.com/lookup");
  url.searchParams.set("id", storeAppId);
  url.searchParams.set("country", country.toUpperCase());
  url.searchParams.set("entity", "software");
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("results" in body) || !Array.isArray(body.results)) return null;
    const row = body.results.find((item: unknown) => item && typeof item === "object" && "trackId" in item && String(item.trackId) === storeAppId);
    if (!row || typeof row.trackName !== "string") return null;
    const screenshots = Array.isArray(row.screenshotUrls) ? row.screenshotUrls.filter((value: unknown) => typeof value === "string" && value.startsWith("https://")) : [];
    return {
      storeAppId,
      country: country.toLowerCase(),
      checkedAt: new Date().toISOString(),
      name: row.trackName,
      description: typeof row.description === "string" ? row.description : null,
      screenshots,
      storeUrl: typeof row.trackViewUrl === "string" && row.trackViewUrl.startsWith("https://apps.apple.com/") ? row.trackViewUrl : null,
      version: typeof row.version === "string" ? row.version : null,
    };
  } catch {
    return null;
  }
}
import { createAdminClient } from "@/lib/supabase/admin";


export async function getTrackedListingKeywords(appId: string, country: string) {
  const db = createAdminClient();
  const { data: links, error: linkError } = await db.from("aso_app_keywords").select("keyword_id").eq("app_id", appId).eq("status", "active").limit(1000);
  if (linkError) throw new Error("Could not read tracked keyword assignments.");
  const ids = (links ?? []).map((row) => row.keyword_id);
  if (!ids.length) return [];
  const { data, error } = await db.from("aso_keywords").select("id,term,country,language").in("id", ids).eq("country", country).order("term").limit(1000);
  if (error) throw new Error("Could not read tracked keywords.");
  return data ?? [];
}
