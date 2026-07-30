import { compareStorefrontWindows, discoveryOpportunities, isImpressionEvent, isPageViewEvent, summarizeStorefrontMetrics, type StorefrontDailyMetric, type StorefrontSourceMetric } from "../lib/metrics";
import { discoveryQueryStart, normalizeDiscoveryDays } from "../lib/discovery-period";
import { assessDiscoveryEvidenceQuality, type DiscoveryReportQualityInput } from "../lib/discovery-quality";
import { createAdminClient } from "@/lib/supabase/admin";

type StorefrontMetricRow = { app_id: string; country: string; date: string; event: string; page_type: string | null; source_type: string | null; count: number | null };
type DailyMetricRow = { app_id: string; country: string; date: string; impressions: number | null; page_views: number | null; downloads: number | null; source: string | null };
type ReportRequestRow = {
  app_id: string;
  last_result_state: DiscoveryReportQualityInput["resultState"];
  parser_version: string | null;
  last_evidence_start: string | null;
  last_evidence_end: string | null;
  last_source_row_count: number | null;
  last_imported_row_count: number | null;
  last_rejected_row_count: number | null;
  last_error: string | null;
};
type StorefrontMetricSummaryRow = {
  appId: string;
  appName: string;
  country: string;
  impressions: number;
  pageViews: number;
  downloads: number;
  impressionToPageRate: number | null;
  downloadRate: number | null;
};

function addDaily(map: Map<string, StorefrontDailyMetric>, date: string, values: Partial<Omit<StorefrontDailyMetric, "date">>) {
  const existing = map.get(date) ?? { date, impressions: 0, pageViews: 0, downloads: 0 };
  existing.impressions += values.impressions ?? 0;
  existing.pageViews += values.pageViews ?? 0;
  existing.downloads += values.downloads ?? 0;
  map.set(date, existing);
}

function addSource(map: Map<string, StorefrontSourceMetric>, sourceType: string, values: Partial<Omit<StorefrontSourceMetric, "sourceType">>) {
  const key = sourceType || "Unknown";
  const existing = map.get(key) ?? { sourceType: key, impressions: 0, pageViews: 0 };
  existing.impressions += values.impressions ?? 0;
  existing.pageViews += values.pageViews ?? 0;
  map.set(key, existing);
}

export async function listStorefrontMetricSummaries(days = 28, appId?: string, country?: string, now = new Date()) {
  const selectedDays = normalizeDiscoveryDays(days);
  const since = discoveryQueryStart(selectedDays, now);
  const db = createAdminClient();
  let storefrontQuery = db.from("aso_storefront_metrics").select("app_id,country,date,event,page_type,source_type,count").gte("date", since).order("date", { ascending: false }).limit(5000);
  let dailyQuery = db.from("aso_daily_metrics").select("app_id,country,date,impressions,page_views,downloads,source").gte("date", since).order("date", { ascending: false }).limit(5000);
  let requestQuery = db.from("aso_analytics_report_requests").select("app_id,last_result_state,parser_version,last_evidence_start,last_evidence_end,last_source_row_count,last_imported_row_count,last_rejected_row_count,last_error").order("created_at", { ascending: false }).limit(100);
  if (appId) {
    storefrontQuery = storefrontQuery.eq("app_id", appId);
    dailyQuery = dailyQuery.eq("app_id", appId);
    requestQuery = requestQuery.eq("app_id", appId);
  }
  if (country && country.toLowerCase() !== "all") {
    storefrontQuery = storefrontQuery.eq("country", country.toLowerCase());
    dailyQuery = dailyQuery.eq("country", country.toLowerCase());
  }
  const [{ data, error }, { data: dailyData, error: dailyError }, { data: requestData, error: requestError }] = await Promise.all([
    storefrontQuery,
    dailyQuery,
    requestQuery,
  ]);
  if (error) throw new Error("Could not read storefront analytics.");
  if (dailyError) throw new Error("Could not read daily App Store Connect metrics.");
  if (requestError) throw new Error("Could not read Discovery report quality.");

  const rawRows = (data ?? []) as StorefrontMetricRow[];
  const dailyRows = (dailyData ?? []) as DailyMetricRow[];
  const requestRows = (requestData ?? []) as ReportRequestRow[];
  const summaries = summarizeStorefrontMetrics(rawRows.map((row) => ({ appId: row.app_id, country: row.country, event: row.event, count: Number(row.count ?? 0) })));
  const summaryMap = new Map(summaries.map((summary) => [`${summary.appId}:${summary.country}`, summary]));
  for (const row of dailyRows) {
    const downloads = Number(row.downloads ?? 0);
    if (!downloads) continue;
    const key = `${row.app_id}:${row.country}`;
    const summary = summaryMap.get(key) ?? { appId: row.app_id, country: row.country, impressions: 0, pageViews: 0, downloads: 0 };
    summary.downloads += downloads;
    summaryMap.set(key, summary);
  }

  const appIds = [...new Set([...rawRows.map((row) => row.app_id), ...dailyRows.map((row) => row.app_id)])];
  const { data: apps, error: appsError } = appIds.length ? await db.from("aso_apps").select("id,name").in("id", appIds) : { data: [], error: null };
  if (appsError) throw new Error("Could not resolve storefront analytics apps.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));

  const daily = new Map<string, StorefrontDailyMetric>();
  for (const row of rawRows) {
    const count = Number(row.count ?? 0);
    addDaily(daily, row.date, { impressions: isImpressionEvent(row.event) ? count : 0, pageViews: isPageViewEvent(row.event) ? count : 0 });
  }
  for (const row of dailyRows) addDaily(daily, row.date, { downloads: Number(row.downloads ?? 0) });

  const sourceTypes = new Map<string, StorefrontSourceMetric>();
  for (const row of rawRows) {
    const count = Number(row.count ?? 0);
    addSource(sourceTypes, row.source_type ?? "Unknown", { impressions: isImpressionEvent(row.event) ? count : 0, pageViews: isPageViewEvent(row.event) ? count : 0 });
  }

  const countries: StorefrontMetricSummaryRow[] = [...summaryMap.values()]
    .map((summary) => ({
      ...summary,
      appName: names.get(summary.appId) ?? "Unknown app",
      impressionToPageRate: summary.impressions ? summary.pageViews / summary.impressions : null,
      downloadRate: summary.pageViews ? summary.downloads / summary.pageViews : null,
    }))
    .sort((a, b) => b.pageViews - a.pageViews || b.downloads - a.downloads || b.impressions - a.impressions);

  const totals = countries.reduce(
    (sum, row) => ({ impressions: sum.impressions + row.impressions, pageViews: sum.pageViews + row.pageViews, downloads: sum.downloads + row.downloads }),
    { impressions: 0, pageViews: 0, downloads: 0 },
  );

  const orderedDaily = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
  const orderedSourceTypes = [...sourceTypes.values()].sort((a, b) => b.pageViews - a.pageViews || b.impressions - a.impressions);
  const hasDiscoveryRows = rawRows.length > 0;
  const hasDailyRows = dailyRows.some((row) => row.downloads !== null && row.source !== "appstore_connect_discovery");
  const trend = compareStorefrontWindows(orderedDaily);
  const discoveryDailyRows = dailyRows.filter((row) => row.source === "appstore_connect_discovery");
  const evidenceDates = [...new Set([
    ...rawRows.map((row) => row.date),
    ...discoveryDailyRows.map((row) => row.date),
  ])].sort();
  const evidenceAppIds = new Set([
    ...rawRows.map((row) => row.app_id),
    ...discoveryDailyRows.map((row) => row.app_id),
  ]);
  const relevantRequests = appId ? requestRows : requestRows.filter((request) => evidenceAppIds.has(request.app_id));
  const quality = assessDiscoveryEvidenceQuality({
    requests: relevantRequests.map((request) => ({
      resultState: request.last_result_state,
      parserVersion: request.parser_version,
      evidenceStart: request.last_evidence_start,
      evidenceEnd: request.last_evidence_end,
      sourceRowCount: request.last_source_row_count,
      importedRowCount: request.last_imported_row_count,
      rejectedRowCount: request.last_rejected_row_count,
      lastError: request.last_error,
    })),
    scopedRowCount: rawRows.length,
    now,
  });

  return {
    days: selectedDays,
    evidenceWindow: {
      start: evidenceDates[0] ?? null,
      end: evidenceDates.at(-1) ?? null,
    },
    countries,
    totals: {
      ...totals,
      impressionToPageRate: totals.impressions ? totals.pageViews / totals.impressions : null,
      downloadRate: totals.pageViews ? totals.downloads / totals.pageViews : null,
    },
    daily: orderedDaily,
    sourceTypes: orderedSourceTypes,
    trend,
    quality,
    opportunities: discoveryOpportunities({ countries, sourceTypes: orderedSourceTypes, trend, hasDiscoveryRows, hasDailyRows, quality }),
    hasDiscoveryRows,
    hasDailyRows,
  };
}
