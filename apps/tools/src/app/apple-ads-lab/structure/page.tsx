import { PageShell } from "@/components/page-shell";
import { rates } from "@/lib/apple-ads/reporting";
import { appleAdsStatusClass, formatAppleAdsDeliveryStatus, formatAppleAdsEntityStatus } from "@/lib/apple-ads/status";
import { requireUser } from "@/lib/auth";
import { analyzeAppleAdsKeywordStructure } from "@/lib/apple-ads/keyword-structure-intelligence";
import { getAppleAdsReporting } from "@/repositories/apple-ads-reporting-repository";
import { listAppleAdsRecommendations } from "@/repositories/apple-ads-recommendation-repository";
import { getAppleAdsStructure, type AppleAdsStructureKeyword } from "@/repositories/apple-ads-structure-repository";

export const dynamic = "force-dynamic";

const formatMoney = (value: number | null, currency: string | null) => value === null ? "-" : new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

function MatchTypeSummary({ keywords }: { keywords: AppleAdsStructureKeyword[] }) {
  const counts = keywords.reduce<Record<string, number>>((all, keyword) => {
    const key = keyword.matchType ?? "Unknown";
    all[key] = (all[key] ?? 0) + 1;
    return all;
  }, {});
  const entries = Object.entries(counts);
  if (!entries.length) return <span>No keywords imported</span>;
  return <>{entries.map(([label, count]) => <span className="badge neutral" key={label}>{label}: {count}</span>)}</>;
}

export default async function AppleAdsStructurePage() {
  const user = await requireUser();
  const [structure, reporting, recommendations] = await Promise.all([getAppleAdsStructure(user.id), getAppleAdsReporting(user.id), listAppleAdsRecommendations(user.id)]);
  const latestSync = structure.campaigns[0]?.sourceSyncedAt;
  const campaignNames = new Map(structure.campaigns.map((campaign) => [campaign.id, campaign.name]));
  const adGroupNames = new Map(structure.adGroups.map((adGroup) => [adGroup.id, adGroup.name]));
  const intelligence = analyzeAppleAdsKeywordStructure(structure);
  const performanceByCampaign = new Map<string, { impressions: number; taps: number; installs: number; spend: number; currency: string | null; latestDate: string | null }>();
  for (const row of reporting.rows) {
    if (!row.campaignId) continue;
    const current = performanceByCampaign.get(row.campaignId) ?? { impressions: 0, taps: 0, installs: 0, spend: 0, currency: row.currency, latestDate: null };
    current.impressions += row.impressions;
    current.taps += row.taps;
    current.installs += row.installs;
    current.spend += row.spend;
    current.currency = current.currency ?? row.currency;
    current.latestDate = current.latestDate && current.latestDate > row.metricDate ? current.latestDate : row.metricDate;
    performanceByCampaign.set(row.campaignId, current);
  }

  return <PageShell title="Campaigns">
    <section className="notice">
      <h2>Imported campaign operations</h2>
      <p>Read-only view of Apple Ads campaign structure and imported performance. A paused campaign can still be audited here.</p>
    </section>

    <section className="metric-grid">
      <article className="metric-card"><p>Campaigns</p><strong>{structure.totals.campaigns}</strong><small>{latestSync ? `Last sync ${latestSync.slice(0, 10)}` : "No sync yet"}</small></article>
      <article className="metric-card"><p>Ad groups</p><strong>{structure.totals.adGroups}</strong><small>Imported structure</small></article>
      <article className="metric-card"><p>Keywords</p><strong>{structure.totals.keywords}</strong><small>Target keywords</small></article>
      <article className="metric-card"><p>Negatives</p><strong>{structure.totals.negativeKeywords}</strong><small>Negative keywords</small></article>
    </section>

    {structure.campaigns.length ? <>
      <div className="section-head"><h2>Campaigns</h2><span>No Apple Ads changes can be made from this page</span></div>
      <div className="structure-grid">
        {structure.campaigns.map((campaign) => { const performance = performanceByCampaign.get(campaign.id); const campaignRates = performance ? rates(performance) : null; const status = formatAppleAdsEntityStatus(campaign.status); const delivery = formatAppleAdsDeliveryStatus(campaign.servingStatus); return <article className="structure-card" key={campaign.id}>
          <header>
            <div><h2>{campaign.name}</h2><p>{campaign.countriesOrRegions.length ? campaign.countriesOrRegions.join(", ") : "No countries imported"}</p></div>
            <span className={appleAdsStatusClass(status)}>{status.label}</span>
          </header>
          <dl>
            <div><dt>Delivery</dt><dd><span className={appleAdsStatusClass(delivery)}>{delivery.label}</span></dd></div>
            <div><dt>Daily budget</dt><dd>{formatMoney(campaign.dailyBudgetAmount, campaign.currency)}</dd></div>
            <div><dt>Spend</dt><dd>{performance ? formatMoney(performance.spend, performance.currency) : "-"}</dd></div>
            <div><dt>Installs</dt><dd>{performance ? formatNumber(performance.installs) : "-"}</dd></div>
            <div><dt>Taps</dt><dd>{performance ? formatNumber(performance.taps) : "-"}</dd></div>
            <div><dt>CPA</dt><dd>{campaignRates?.averageCpa == null ? "-" : formatMoney(campaignRates.averageCpa, performance?.currency ?? campaign.currency)}</dd></div>
            <div><dt>Ad groups</dt><dd>{campaign.adGroupCount}</dd></div>
            <div><dt>Keywords</dt><dd>{campaign.keywordCount}</dd></div>
          </dl>
        </article>; })}
      </div>

      <div className="section-head"><h2>Campaign performance</h2><span>{reporting.rows.length ? "Imported daily metrics" : "Waiting for first report"}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Campaign</th><th>Market</th><th>Latest date</th><th>Impressions</th><th>Taps</th><th>Installs</th><th>Spend</th><th>CPA</th></tr></thead>
        <tbody>{structure.campaigns.length ? structure.campaigns.map((campaign) => { const performance = performanceByCampaign.get(campaign.id); const campaignRates = performance ? rates(performance) : null; return <tr key={campaign.id}><td>{campaign.name}</td><td>{campaign.countriesOrRegions.length ? campaign.countriesOrRegions.join(", ") : "-"}</td><td>{performance?.latestDate ?? "-"}</td><td>{performance ? formatNumber(performance.impressions) : "0"}</td><td>{performance ? formatNumber(performance.taps) : "0"}</td><td>{performance ? formatNumber(performance.installs) : "0"}</td><td>{performance ? formatMoney(performance.spend, performance.currency) : "-"}</td><td>{campaignRates?.averageCpa == null ? "-" : formatMoney(campaignRates.averageCpa, performance?.currency ?? campaign.currency)}</td></tr>; }) : <tr><td colSpan={8}>No campaigns imported yet.</td></tr>}</tbody>
      </table></div>

      <div className="section-head"><h2>Campaign details</h2><span>Structure, reporting, warnings, and recommendations</span></div>
      <div className="campaign-detail-list">
        {structure.campaigns.map((campaign) => {
          const campaignAdGroups = structure.adGroups.filter((adGroup) => adGroup.campaignId === campaign.id);
          const campaignKeywords = structure.keywords.filter((keyword) => keyword.campaignId === campaign.id);
          const campaignNegatives = structure.negativeKeywords.filter((keyword) => keyword.campaignId === campaign.id);
          const dailyRows = reporting.rows.filter((row) => row.campaignId === campaign.id).slice(0, 14);
          const campaignRecommendations = recommendations.filter((recommendation) => !recommendation.appId || recommendation.appId === campaign.appId).slice(0, 4);
          const warningNames = new Set(campaignAdGroups.map((adGroup) => adGroup.name));
          const warnings = intelligence.findings.filter((finding) => finding.severity !== "info" && [...warningNames].some((name) => finding.evidence.includes(name))).slice(0, 4);
          return <details className="campaign-detail" key={campaign.id}>
            <summary><span>{campaign.name}</span><small>{campaign.countriesOrRegions.length ? campaign.countriesOrRegions.join(", ") : "No market"} · {campaignAdGroups.length} ad groups · {campaignKeywords.length} keywords</small></summary>
            <div className="campaign-detail-body">
              <section>
                <h3>Ad groups</h3>
                <div className="table-wrap"><table>
                  <thead><tr><th>Ad group</th><th>Status</th><th>Search Match</th><th>Default bid</th><th>Keywords</th><th>Negatives</th></tr></thead>
                  <tbody>{campaignAdGroups.length ? campaignAdGroups.map((adGroup) => { const status = formatAppleAdsEntityStatus(adGroup.status); return <tr key={adGroup.id}><td>{adGroup.name}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td><td>{adGroup.searchMatchEnabled ? "On" : "Off"}</td><td>{formatMoney(adGroup.defaultBidAmount, adGroup.currency)}</td><td>{adGroup.keywordCount}</td><td>{adGroup.negativeKeywordCount}</td></tr>; }) : <tr><td colSpan={6}>No ad groups imported for this campaign.</td></tr>}</tbody>
                </table></div>
              </section>
              <section>
                <h3>Targeted keywords</h3>
                <div className="table-wrap"><table>
                  <thead><tr><th>Keyword</th><th>Ad group</th><th>Match</th><th>Status</th><th>Delivery</th><th>Bid</th></tr></thead>
                  <tbody>{campaignKeywords.length ? campaignKeywords.slice(0, 40).map((keyword) => { const status = formatAppleAdsEntityStatus(keyword.status); const delivery = formatAppleAdsDeliveryStatus(keyword.servingStatus); return <tr key={keyword.id}><td>{keyword.keywordText}</td><td>{adGroupNames.get(keyword.adGroupId) ?? "Ad group"}</td><td>{keyword.matchType ?? "-"}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td><td><span className={appleAdsStatusClass(delivery)}>{delivery.label}</span></td><td>{formatMoney(keyword.bidAmount, keyword.currency)}</td></tr>; }) : <tr><td colSpan={6}>No target keywords imported for this campaign.</td></tr>}</tbody>
                </table></div>
              </section>
              <section className="campaign-detail-grid">
                <article>
                  <h3>Daily performance</h3>
                  <div className="table-wrap"><table>
                    <thead><tr><th>Date</th><th>Market</th><th>Impressions</th><th>Taps</th><th>Installs</th><th>Spend</th></tr></thead>
                    <tbody>{dailyRows.length ? dailyRows.map((row) => <tr key={row.id}><td>{row.metricDate}</td><td>{row.country.toUpperCase()}</td><td>{formatNumber(row.impressions)}</td><td>{formatNumber(row.taps)}</td><td>{formatNumber(row.installs)}</td><td>{formatMoney(row.spend, row.currency)}</td></tr>) : <tr><td colSpan={6}>No daily performance rows imported for this campaign.</td></tr>}</tbody>
                  </table></div>
                </article>
                <article>
                  <h3>Structure warnings</h3>
                  <div className="quality-list">{warnings.length ? warnings.map((warning) => <div className="quality-card" key={warning.id}><div><h2>{warning.title}</h2><p>{warning.detail}</p></div><span className="badge bad">{warning.severity}</span></div>) : <div className="quality-card"><div><h2>No campaign warnings</h2><p>No campaign-specific structure warnings were detected from imported setup data.</p></div><span className="badge good">Ready</span></div>}</div>
                </article>
              </section>
              <section className="campaign-detail-grid">
                <article>
                  <h3>Negative keywords</h3>
                  <div className="table-wrap"><table>
                    <thead><tr><th>Keyword</th><th>Scope</th><th>Match</th><th>Status</th></tr></thead>
                    <tbody>{campaignNegatives.length ? campaignNegatives.slice(0, 40).map((keyword) => { const status = formatAppleAdsEntityStatus(keyword.status); return <tr key={keyword.id}><td>{keyword.keywordText}</td><td>{keyword.adGroupId ? adGroupNames.get(keyword.adGroupId) ?? "Ad group" : "Campaign"}</td><td>{keyword.matchType ?? "-"}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td></tr>; }) : <tr><td colSpan={4}>No negatives imported for this campaign.</td></tr>}</tbody>
                  </table></div>
                </article>
                <article>
                  <h3>Recommendations</h3>
                  <div className="quality-list">{campaignRecommendations.length ? campaignRecommendations.map((recommendation) => <div className="quality-card" key={recommendation.id}><div><h2>{recommendation.title}</h2><p>{recommendation.evidence}</p></div><span className="badge neutral">{recommendation.priority}</span></div>) : <div className="quality-card"><div><h2>No linked recommendations</h2><p>No active Apple Ads recommendation is currently linked to this campaign app.</p></div><span className="badge neutral">None</span></div>}</div>
                </article>
              </section>
            </div>
          </details>;
        })}
      </div>

      <div className="section-head"><h2>Ad groups</h2><span><MatchTypeSummary keywords={structure.keywords} /></span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Ad group</th><th>Campaign</th><th>Status</th><th>Search match</th><th>Default bid</th><th>Keywords</th><th>Negatives</th></tr></thead>
        <tbody>{structure.adGroups.map((adGroup) => { const status = formatAppleAdsEntityStatus(adGroup.status); return <tr key={adGroup.id}>
          <td>{adGroup.name}</td><td>{campaignNames.get(adGroup.campaignId) ?? "Campaign"}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td><td>{adGroup.searchMatchEnabled ? "On" : "Off"}</td><td>{formatMoney(adGroup.defaultBidAmount, adGroup.currency)}</td><td>{adGroup.keywordCount}</td><td>{adGroup.negativeKeywordCount}</td>
        </tr>; })}</tbody>
      </table></div>

      <div className="section-head"><h2>Keywords</h2><span>{structure.keywords.length >= 500 ? "Showing first 500" : `${structure.keywords.length} imported`}</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Keyword</th><th>Ad group</th><th>Match</th><th>Status</th><th>Delivery</th><th>Bid</th></tr></thead>
        <tbody>{structure.keywords.map((keyword) => { const status = formatAppleAdsEntityStatus(keyword.status); const delivery = formatAppleAdsDeliveryStatus(keyword.servingStatus); return <tr key={keyword.id}>
          <td>{keyword.keywordText}</td><td>{adGroupNames.get(keyword.adGroupId) ?? "Ad group"}</td><td>{keyword.matchType ?? "-"}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td><td><span className={appleAdsStatusClass(delivery)}>{delivery.label}</span></td><td>{formatMoney(keyword.bidAmount, keyword.currency)}</td>
        </tr>; })}</tbody>
      </table></div>

      {structure.negativeKeywords.length ? <>
        <div className="section-head"><h2>Negative keywords</h2><span>{structure.negativeKeywords.length >= 500 ? "Showing first 500" : `${structure.negativeKeywords.length} imported`}</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Keyword</th><th>Ad group</th><th>Match</th><th>Status</th></tr></thead>
          <tbody>{structure.negativeKeywords.map((keyword) => { const status = formatAppleAdsEntityStatus(keyword.status); return <tr key={keyword.id}>
            <td>{keyword.keywordText}</td><td>{keyword.adGroupId ? adGroupNames.get(keyword.adGroupId) ?? "Ad group" : "Campaign level"}</td><td>{keyword.matchType ?? "-"}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td>
          </tr>; })}</tbody>
        </table></div>
      </> : null}
    </> : <section className="notice"><h2>No imported structure yet</h2><p>Run campaign sync and structure sync from Apple Ads Lab after connecting an organization. Once imported, campaigns, ad groups, and keywords appear here.</p></section>}
  </PageShell>;
}
