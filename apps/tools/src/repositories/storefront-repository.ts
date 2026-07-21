import { createAdminClient } from "@/lib/supabase/admin";
import type { StorefrontRow } from "@/types/domain";

type MarketRecord = {
  id: string;
  appId: string;
  appName: string;
  country: string;
  isPrimary: boolean;
  metadataLocalised: boolean;
  screenshotsLocalised: boolean;
  notes: string | null;
};

const countryLanguages: Record<string, string[]> = {
  de: ["de"],
  fr: ["fr"],
  gb: ["en"],
  jp: ["ja"],
  us: ["en"],
};

const normalizeCountry = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const keyFor = (appId: string, country: string) => `${appId}:${normalizeCountry(country)}`;

function noteState(notes: string | null, phrases: string[]): "localized" | "english" | "unknown" {
  const text = (notes ?? "").toLowerCase();
  if (!text) return "unknown";
  if (phrases.some((phrase) => text.includes(`${phrase} localized`) || text.includes(`${phrase} localised`))) return "localized";
  if (phrases.some((phrase) => text.includes(`${phrase} english`) || text.includes(`${phrase} remains english`))) return "english";
  return "unknown";
}

function appLanguageState(country: string, languages: string[] | null): "localized" | "english" | "unknown" {
  if (!languages?.length) return "unknown";
  const normalized = new Set(languages.map((language) => language.toLowerCase()));
  const expected = countryLanguages[normalizeCountry(country)];
  if (expected?.some((language) => normalized.has(language))) return "localized";
  if (normalized.has("en")) return "english";
  return "unknown";
}

function readiness(row: { metadataLocalised: boolean; screenshotsLocalised: boolean; screenshotUiState: string; appLanguageState: string; keywordsTracked: number; hasAscData: boolean; appleAdsActive: boolean }) {
  if (row.metadataLocalised && row.screenshotsLocalised && row.screenshotUiState === "localized" && row.appLanguageState === "localized") return "Fully localized";
  if (row.metadataLocalised && row.screenshotsLocalised && (row.screenshotUiState === "english" || row.appLanguageState === "english")) return "Needs review";
  if (row.metadataLocalised && row.screenshotsLocalised) return "Headlines localized";
  if (row.metadataLocalised) return "Metadata localized";
  if (row.keywordsTracked) return "Tracking only";
  if (row.appleAdsActive) return "Apple Ads active";
  if (row.hasAscData) return "ASC data only";
  return "Not optimized";
}

export async function listStorefronts(appId?: string): Promise<StorefrontRow[]> {
  const db = createAdminClient();
  const [{ data: apps, error: appsError }, { data: storefronts, error: storefrontError }, { data: appKeywords, error: appKeywordError }, { data: metrics, error: metricsError }, { data: campaigns, error: campaignError }] = await Promise.all([
    appId ? db.from("aso_apps").select("id,name,primary_country,languages").eq("id", appId) : db.from("aso_apps").select("id,name,primary_country,languages").order("name").limit(100),
    appId ? db.from("aso_app_storefronts").select("id,app_id,country,is_primary,metadata_localised,screenshots_localised,notes").eq("app_id", appId).order("country").limit(200) : db.from("aso_app_storefronts").select("id,app_id,country,is_primary,metadata_localised,screenshots_localised,notes").order("country").limit(200),
    appId ? db.from("aso_app_keywords").select("app_id,keyword_id").eq("app_id", appId).limit(5000) : db.from("aso_app_keywords").select("app_id,keyword_id").limit(5000),
    appId ? db.from("aso_storefront_metrics").select("app_id,country").eq("app_id", appId).limit(5000) : db.from("aso_storefront_metrics").select("app_id,country").limit(5000),
    appId ? db.from("apple_ads_campaigns").select("app_id,countries_or_regions,status,serving_status").eq("app_id", appId).eq("is_deleted", false).limit(1000) : db.from("apple_ads_campaigns").select("app_id,countries_or_regions,status,serving_status").eq("is_deleted", false).limit(1000),
  ]);
  if (appsError) throw new Error("Could not resolve storefront apps.");
  if (storefrontError) throw new Error("Could not read storefront coverage.");
  if (appKeywordError) throw new Error("Could not read tracked keyword markets.");
  if (metricsError) throw new Error("Could not read storefront analytics coverage.");
  if (campaignError) throw new Error("Could not read Apple Ads market coverage.");

  const appRows = apps ?? [];
  const appIds = appRows.map((app) => app.id);
  if (!appIds.length) return [];
  const appById = new Map(appRows.map((app) => [app.id, app]));
  const names = new Map(appRows.map((app) => [app.id, app.name]));
  const keywordIds = [...new Set((appKeywords ?? []).map((row) => row.keyword_id))];
  const { data: keywords, error: keywordError } = keywordIds.length ? await db.from("aso_keywords").select("id,country").in("id", keywordIds) : { data: [], error: null };
  if (keywordError) throw new Error("Could not resolve keyword markets.");
  const keywordCountryById = new Map((keywords ?? []).map((keyword) => [keyword.id, normalizeCountry(keyword.country)]));

  const keywordCounts = new Map<string, number>();
  for (const row of appKeywords ?? []) {
    const country = keywordCountryById.get(row.keyword_id);
    if (!country) continue;
    const key = keyFor(row.app_id, country);
    keywordCounts.set(key, (keywordCounts.get(key) ?? 0) + 1);
  }

  const hasAscData = new Set<string>();
  for (const row of metrics ?? []) if (row.app_id && row.country) hasAscData.add(keyFor(row.app_id, row.country));

  const hasAppleAds = new Set<string>();
  for (const campaign of campaigns ?? []) {
    if (!campaign.app_id || !Array.isArray(campaign.countries_or_regions)) continue;
    const active = /enabled|active|running/i.test(`${campaign.status ?? ""} ${campaign.serving_status ?? ""}`);
    if (!active) continue;
    for (const country of campaign.countries_or_regions) if (typeof country === "string") hasAppleAds.add(keyFor(campaign.app_id, country));
  }

  const markets = new Map<string, MarketRecord>();
  function ensure(appIdValue: string, countryValue: string): MarketRecord {
    const country = normalizeCountry(countryValue);
    const key = keyFor(appIdValue, country);
    const existing = markets.get(key);
    if (existing) return existing;
    const app = appById.get(appIdValue);
    const record = {
      id: key,
      appId: appIdValue,
      appName: names.get(appIdValue) ?? "Unknown app",
      country,
      isPrimary: normalizeCountry(app?.primary_country) === country,
      metadataLocalised: false,
      screenshotsLocalised: false,
      notes: null,
    };
    markets.set(key, record);
    return record;
  }

  for (const app of appRows) ensure(app.id, app.primary_country);
  for (const row of storefronts ?? []) Object.assign(ensure(row.app_id, row.country), { id: row.id, isPrimary: row.is_primary, metadataLocalised: row.metadata_localised, screenshotsLocalised: row.screenshots_localised, notes: row.notes });
  for (const key of keywordCounts.keys()) {
    const [marketAppId, country] = key.split(":");
    ensure(marketAppId, country);
  }
  for (const key of hasAscData) {
    const [marketAppId, country] = key.split(":");
    ensure(marketAppId, country);
  }
  for (const key of hasAppleAds) {
    const [marketAppId, country] = key.split(":");
    ensure(marketAppId, country);
  }

  return [...markets.values()].sort((a, b) => a.appName.localeCompare(b.appName) || a.country.localeCompare(b.country)).map((market) => {
    const app = appById.get(market.appId);
    const languages = Array.isArray(app?.languages) ? app.languages.filter((language): language is string => typeof language === "string") : null;
    const screenshotUiState = noteState(market.notes, ["screenshot ui", "in-screenshot ui", "ui"]);
    const languageState = noteState(market.notes, ["app content", "app language"]);
    const appContentState = languageState === "unknown" ? appLanguageState(market.country, languages) : languageState;
    const key = keyFor(market.appId, market.country);
    const result = {
      ...market,
      screenshotUiState,
      appLanguageState: appContentState,
      keywordsTracked: keywordCounts.get(key) ?? 0,
      hasAscData: hasAscData.has(key),
      appleAdsActive: hasAppleAds.has(key),
    };
    return { ...result, readiness: readiness(result) };
  });
}
