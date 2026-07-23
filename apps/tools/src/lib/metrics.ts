export type MetricInput = { appId: string; country: string; event: string; count: number };
export type StorefrontMetricSummary = { appId: string; country: string; impressions: number; pageViews: number; downloads: number };
export type StorefrontDailyMetric = { date: string; impressions: number; pageViews: number; downloads: number };
export type StorefrontSourceMetric = { sourceType: string; impressions: number; pageViews: number };
export type StorefrontOpportunityInput = StorefrontMetricSummary & { appName?: string; impressionToPageRate: number | null; downloadRate: number | null };
export type StorefrontTrend = {
  current: { impressions: number; pageViews: number; downloads: number };
  previous: { impressions: number; pageViews: number; downloads: number };
  changes: { impressions: number | null; pageViews: number | null; downloads: number | null };
};
export type StorefrontOpportunity = { title: string; detail: string; severity: "attention" | "opportunity" | "waiting"; appId?: string; appName?: string | null; country?: string };

function normalizedEvent(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isImpressionEvent(event: string) {
  const normalized = normalizedEvent(event);
  return normalized === "impression" || normalized === "impressions";
}

export function isPageViewEvent(event: string) {
  const normalized = normalizedEvent(event);
  return normalized === "page_view" || normalized === "page_views";
}

export function isDownloadEvent(event: string) {
  const normalized = normalizedEvent(event);
  return normalized === "download" || normalized === "downloads";
}

export function summarizeStorefrontMetrics(rows: MetricInput[]): StorefrontMetricSummary[] {
  const grouped = new Map<string, StorefrontMetricSummary>();
  for (const row of rows) {
    const key = `${row.appId}:${row.country}`;
    const summary = grouped.get(key) ?? { appId: row.appId, country: row.country, impressions: 0, pageViews: 0, downloads: 0 };
    if (isImpressionEvent(row.event)) summary.impressions += row.count;
    if (isPageViewEvent(row.event)) summary.pageViews += row.count;
    if (isDownloadEvent(row.event)) summary.downloads += row.count;
    grouped.set(key, summary);
  }
  return [...grouped.values()].sort((a, b) => b.pageViews - a.pageViews || b.downloads - a.downloads);
}

function pctChange(current: number, previous: number) {
  if (!previous) return current ? 1 : null;
  return (current - previous) / previous;
}

function formatCountry(country: string) {
  return country === "all" ? "all storefronts" : country.toUpperCase();
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function compareStorefrontWindows(daily: StorefrontDailyMetric[]): StorefrontTrend {
  const midpoint = Math.floor(daily.length / 2);
  const previousRows = daily.slice(0, midpoint);
  const currentRows = daily.slice(midpoint);
  const sum = (rows: StorefrontDailyMetric[]) => rows.reduce((total, row) => ({
    impressions: total.impressions + row.impressions,
    pageViews: total.pageViews + row.pageViews,
    downloads: total.downloads + row.downloads,
  }), { impressions: 0, pageViews: 0, downloads: 0 });
  const current = sum(currentRows);
  const previous = sum(previousRows);
  return {
    current,
    previous,
    changes: {
      impressions: pctChange(current.impressions, previous.impressions),
      pageViews: pctChange(current.pageViews, previous.pageViews),
      downloads: pctChange(current.downloads, previous.downloads),
    },
  };
}

export function discoveryOpportunities(input: {
  countries: StorefrontOpportunityInput[];
  sourceTypes: StorefrontSourceMetric[];
  trend: StorefrontTrend;
  hasDiscoveryRows: boolean;
  hasDailyRows: boolean;
}): StorefrontOpportunity[] {
  if (!input.hasDiscoveryRows) return [{ severity: "waiting", title: "Waiting for Discovery report data", detail: "Retry the Discovery report import after Apple has generated at least one daily segment." }];

  const opportunities: StorefrontOpportunity[] = [];
  const bestExposure = input.countries.find((row) => row.impressions >= 50 && row.impressionToPageRate !== null);
  if (bestExposure && bestExposure.impressionToPageRate !== null && bestExposure.impressionToPageRate < 0.05) {
    opportunities.push({
      severity: "attention",
      title: `${formatCountry(bestExposure.country)} has weak page-view pull`,
      detail: `${bestExposure.appName ?? "Tracked app"} received ${bestExposure.impressions.toLocaleString("en-US")} impressions, but only ${formatPercent(bestExposure.impressionToPageRate)} became product page views.`,
      appId: bestExposure.appId,
      appName: bestExposure.appName ?? null,
      country: bestExposure.country,
    });
  }

  const conversionCandidate = input.countries.find((row) => row.pageViews >= 20 && row.downloadRate !== null && row.downloadRate < 0.08);
  if (conversionCandidate && conversionCandidate.downloadRate !== null) {
    opportunities.push({
      severity: "attention",
      title: `${formatCountry(conversionCandidate.country)} page views are not converting`,
      detail: `${conversionCandidate.appName ?? "Tracked app"} has ${conversionCandidate.pageViews.toLocaleString("en-US")} product page views with ${formatPercent(conversionCandidate.downloadRate)} download conversion.`,
      appId: conversionCandidate.appId,
      appName: conversionCandidate.appName ?? null,
      country: conversionCandidate.country,
    });
  }

  const growingSource = input.sourceTypes.find((source) => source.pageViews > 0);
  if (growingSource) {
    opportunities.push({
      severity: "opportunity",
      title: `${growingSource.sourceType} is the strongest discovery source`,
      detail: `${growingSource.pageViews.toLocaleString("en-US")} product page views came from this source in the selected window. Use it as context before interpreting keyword or ad changes.`,
    });
  }

  if (input.trend.changes.pageViews !== null && input.trend.changes.pageViews <= -0.2) {
    opportunities.push({
      severity: "attention",
      title: "Product page views are down",
      detail: `The latest half of the window has ${formatPercent(Math.abs(input.trend.changes.pageViews))} fewer product page views than the previous half.`,
    });
  } else if (input.trend.changes.pageViews !== null && input.trend.changes.pageViews >= 0.2) {
    opportunities.push({
      severity: "opportunity",
      title: "Product page views are rising",
      detail: `The latest half of the window has ${formatPercent(input.trend.changes.pageViews)} more product page views than the previous half.`,
    });
  }

  if (!input.hasDailyRows) opportunities.push({ severity: "waiting", title: "Waiting for download import", detail: "Discovery can show exposure now; download conversion becomes reliable after the sales/download import stores daily rows." });

  return opportunities.slice(0, 4);
}
