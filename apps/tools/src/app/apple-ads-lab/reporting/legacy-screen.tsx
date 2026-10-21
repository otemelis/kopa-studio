import { PageShell } from "@/components/page-shell";
import { rates } from "@/lib/apple-ads/reporting";
import { requireUser } from "@/lib/auth";
import { getAppleAdsReporting } from "@/repositories/apple-ads-reporting-repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const formatMoney = (value: number, currency: string | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(value);
const formatPercent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;
const formatDateTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export default async function AppleAdsReportingPage() {
  const user = await requireUser();
  const { rows, summary } = await getAppleAdsReporting(user.id);
  const currency = rows.find((row) => row.currency)?.currency ?? null;
  const dates = [...new Set(rows.map((row) => row.metricDate))].sort();
  const campaigns = [...new Set(rows.map((row) => row.campaignName))];
  const countries = [...new Set(rows.map((row) => row.country.toUpperCase()))].sort();
  const latestSync = rows.map((row) => row.sourceSyncedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

  return <PageShell title="Apple Ads reporting">
    <section className="notice">
      <h2>Validate before acting</h2>
      <p>Compare these totals with Apple Ads using the same campaign names, date window, countries, and currency. Kopa imports daily campaign performance only; it does not alter Apple Ads.</p>
    </section>

    {rows.length ? <>
      <section className="metric-grid">
        <article className="metric-card"><p>Impressions</p><strong>{formatNumber(summary.impressions)}</strong><small>Imported daily data</small></article>
        <article className="metric-card"><p>Taps</p><strong>{formatNumber(summary.taps)}</strong><small>{formatPercent(summary.tapThroughRate)} tap-through rate</small></article>
        <article className="metric-card"><p>Installs</p><strong>{formatNumber(summary.installs)}</strong><small>{formatPercent(summary.conversionRate)} tap-to-install</small></article>
        <article className="metric-card"><p>Spend</p><strong>{formatMoney(summary.spend, currency)}</strong><small>{summary.averageCpa === null ? "No CPA yet" : `${formatMoney(summary.averageCpa, currency)} per install`}</small></article>
      </section>

      <div className="section-head"><h2>Import coverage</h2><span>Use this for your Apple Ads cross-check</span></div>
      <div className="table-wrap"><table><tbody>
        <tr><th scope="row">Date window</th><td>{dates[0]} to {dates.at(-1)} · {dates.length} daily date{dates.length === 1 ? "" : "s"}</td></tr>
        <tr><th scope="row">Campaigns</th><td>{campaigns.join(", ")}</td></tr>
        <tr><th scope="row">Markets</th><td>{countries.join(", ")}</td></tr>
        <tr><th scope="row">Imported rows</th><td>{rows.length} campaign-day-market row{rows.length === 1 ? "" : "s"}</td></tr>
        <tr><th scope="row">Last source sync</th><td>{formatDateTime(latestSync)}</td></tr>
      </tbody></table></div>

      <div className="section-head"><h2>Daily performance</h2><span>Every stored campaign-day-market row</span></div>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Campaign</th><th>Market</th><th>Impressions</th><th>Taps</th><th>Installs</th><th>Spend</th><th>CPA</th></tr></thead><tbody>{rows.map((row) => {
        const rowRates = rates(row);
        return <tr key={row.id}><td>{row.metricDate}</td><td>{row.campaignName}</td><td>{row.country.toUpperCase()}</td><td>{formatNumber(row.impressions)}</td><td>{formatNumber(row.taps)}</td><td>{formatNumber(row.installs)}</td><td>{formatMoney(row.spend, row.currency)}</td><td>{rowRates.averageCpa === null ? "—" : formatMoney(rowRates.averageCpa, row.currency)}</td></tr>;
      })}</tbody></table></div>
    </> : <section className="notice"><h2>Ready for the first report</h2><p>There are no daily performance rows yet. Use <strong>Sync last 7 days</strong> on Apple Ads Lab once the campaign has delivered.</p></section>}

    <section className="notice"><h2>Next evidence check</h2><p>Campaign totals can be valid even when no search-term rows are available. Review <Link href="/apple-ads-lab/keyword-intelligence#search-terms">Keywords &amp; Search Terms</Link> to see query coverage and recommendation eligibility.</p></section>
  </PageShell>;
}
