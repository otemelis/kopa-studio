import type { PaidSearchMetric, ProgressMetric, SalesMetric } from "@/repositories/aso-progress-repository";

export function completeTotal(values: (number | null)[]): number | null {
  return values.length && values.every((value) => value !== null && Number.isFinite(value))
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
}

export function summarizePoisSources(
  metrics: ProgressMetric[], sales: SalesMetric[], paid: PaidSearchMetric[],
  country: string, since: string, through: string,
) {
  const market = country.toUpperCase();
  const asc = metrics.filter((row) => row.country.toUpperCase() === market && row.date >= since && row.date <= through);
  const units = sales.filter((row) => row.country.toUpperCase() === market && row.date >= since && row.date <= through && row.source === "appstore_connect_sales");
  const firstDownloads = sales.filter((row) => row.country.toUpperCase() === market && row.date >= since && row.date <= through && row.source === "appstore_connect_first_time_downloads");
  const ads = paid.filter((row) => row.country?.toUpperCase() === market && row.metric_date >= since && row.metric_date <= through);
  const counts = (event: string, pageType?: string) => completeTotal(asc.filter((row) =>
    row.event.toLowerCase() === event.toLowerCase() && (!pageType || row.page_type?.toLowerCase() === pageType.toLowerCase()),
  ).map((row) => row.count));
  return {
    impressions: counts("Impression"),
    pageViews: counts("Page view", "Product page"),
    salesUnits: completeTotal(units.map((row) => row.downloads)),
    firstTimeDownloads: completeTotal(firstDownloads.map((row) => row.downloads)),
    firstTimeDownloadsLatest: firstDownloads.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null),
    adImpressions: completeTotal(ads.map((row) => row.impressions)),
    adTaps: completeTotal(ads.map((row) => row.taps)),
    adInstalls: completeTotal(ads.map((row) => row.installs)),
    adSpend: ads.length && ads.every((row) => row.currency === ads[0].currency && row.currency !== null)
      ? completeTotal(ads.map((row) => row.spend)) : null,
    adCurrency: ads.length && ads.every((row) => row.currency === ads[0].currency) ? ads[0].currency : null,
    ascLatest: asc.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null),
    salesLatest: units.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null),
    adsLatest: ads.reduce<string | null>((latest, row) => !latest || row.metric_date > latest ? row.metric_date : latest, null),
  };
}
