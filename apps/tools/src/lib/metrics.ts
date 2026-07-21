export type MetricInput = { appId: string; country: string; event: string; count: number };
export type StorefrontMetricSummary = { appId: string; country: string; impressions: number; pageViews: number; downloads: number };

export function summarizeStorefrontMetrics(rows: MetricInput[]): StorefrontMetricSummary[] {
  const grouped = new Map<string, StorefrontMetricSummary>();
  for (const row of rows) {
    const key = `${row.appId}:${row.country}`;
    const summary = grouped.get(key) ?? { appId: row.appId, country: row.country, impressions: 0, pageViews: 0, downloads: 0 };
    if (row.event === "impressions") summary.impressions += row.count;
    if (row.event === "page_view" || row.event === "page_views") summary.pageViews += row.count;
    if (row.event === "download" || row.event === "downloads") summary.downloads += row.count;
    grouped.set(key, summary);
  }
  return [...grouped.values()].sort((a, b) => b.pageViews - a.pageViews || b.downloads - a.downloads);
}
