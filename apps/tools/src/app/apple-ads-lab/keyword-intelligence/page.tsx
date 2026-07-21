import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { analyzeAppleAdsKeywordStructure, type KeywordSetupFinding } from "@/lib/apple-ads/keyword-structure-intelligence";
import { appleAdsStatusClass, formatAppleAdsEntityStatus } from "@/lib/apple-ads/status";
import { requireUser } from "@/lib/auth";
import { listAppleAdsSearchTerms } from "@/repositories/apple-ads-search-term-repository";
import { getAppleAdsStructure } from "@/repositories/apple-ads-structure-repository";

export const dynamic = "force-dynamic";

const formatMoney = (value: number | null, currency: string | null) => value === null ? "-" : new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(value);
const findingStatus = (severity: KeywordSetupFinding["severity"]) => severity === "attention" ? "error" : severity === "warning" ? "waiting" : "configured";
const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

export default async function AppleAdsKeywordIntelligencePage() {
  const user = await requireUser();
  const [structure, searchTerms] = await Promise.all([getAppleAdsStructure(user.id), listAppleAdsSearchTerms(user.id)]);
  const intelligence = analyzeAppleAdsKeywordStructure(structure);
  const adGroupNames = new Map(structure.adGroups.map((adGroup) => [adGroup.id, adGroup.name]));
  const campaignNames = new Map(structure.campaigns.map((campaign) => [campaign.id, campaign.name]));
  const campaignMarkets = new Map(structure.campaigns.map((campaign) => [campaign.id, campaign.countriesOrRegions.length ? campaign.countriesOrRegions.join(", ") : "-"]));
  const opportunities = intelligence.findings.filter((finding) => ["duplicates", "missing-negatives", "broad-only", "exact-only"].includes(finding.id));

  return <PageShell title="Keywords & Search Terms">
    <section className="notice">
      <h2>Paid keyword workspace</h2>
      <p>Imported target keywords, negatives, and setup opportunities. Search terms will appear here once the reporting importer stores search-term rows.</p>
    </section>

    <section className="metric-grid">
      <article className="metric-card"><p>Targeted keywords</p><strong>{intelligence.summary.keywords}</strong><small>Imported target rows</small></article>
      <article className="metric-card"><p>Negatives</p><strong>{structure.negativeKeywords.length}</strong><small>Imported negative rows</small></article>
      <article className="metric-card"><p>Search terms</p><strong>{searchTerms.length}</strong><small>{searchTerms.length ? "Imported query rows" : "Awaiting importer support"}</small></article>
      <article className="metric-card"><p>Opportunities</p><strong>{opportunities.length}</strong><small>Structure-based checks</small></article>
    </section>

    <nav className="workspace-tabs" aria-label="Apple Ads keyword views">
      <a href="#targeted-keywords">Targeted Keywords</a>
      <a href="#search-terms">Search Terms</a>
      <a href="#negatives">Negatives</a>
      <a href="#opportunities">Opportunities</a>
    </nav>

    <div className="section-head" id="opportunities"><h2>Opportunities</h2><span>Recommendation-ready evidence before spend</span></div>
    <div className="quality-list">
      {opportunities.length ? opportunities.map((finding) => <article className="quality-card" key={finding.id}>
        <div><h2>{finding.title}</h2><p>{finding.detail}</p><small>{finding.evidence}</small></div>
        <StatusBadge status={findingStatus(finding.severity)} />
      </article>) : <article className="quality-card"><div><h2>No structure opportunities detected</h2><p>Targeted keyword and negative structure does not currently produce an actionable setup opportunity.</p></div><StatusBadge status="configured" /></article>}
    </div>

    <div className="section-head"><h2>Ad group coverage</h2><span>Match and negative structure</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Ad group</th><th>Campaign</th><th>Keywords</th><th>Negatives</th><th>Exact</th><th>Broad</th><th>Search match</th></tr></thead>
      <tbody>{intelligence.adGroups.length ? intelligence.adGroups.map((adGroup) => <tr key={adGroup.id}>
        <td>{adGroup.adGroupName}</td><td>{adGroup.campaignName}</td><td>{adGroup.keywordCount}</td><td>{adGroup.negativeKeywordCount}</td><td>{adGroup.hasExact ? "Yes" : "No"}</td><td>{adGroup.hasBroad ? "Yes" : "No"}</td><td>{adGroup.searchMatchEnabled ? "On" : "Off"}</td>
      </tr>) : <tr><td colSpan={7}>No ad groups imported yet.</td></tr>}</tbody>
    </table></div>

    <div className="section-head" id="targeted-keywords"><h2>Targeted Keywords</h2><span>{intelligence.keywords.length >= 500 ? "Showing first 500" : `${intelligence.keywords.length} imported`}</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Keyword</th><th>Campaign</th><th>Ad group</th><th>Market</th><th>Match</th><th>Status</th><th>Bid</th><th>Label</th><th>Duplicate count</th><th>Negative match</th><th>Performance</th></tr></thead>
      <tbody>{intelligence.keywords.length ? intelligence.keywords.map((keyword) => { const status = formatAppleAdsEntityStatus(keyword.status); return <tr key={keyword.id}>
        <td>{keyword.keywordText}</td><td>{keyword.campaignName}</td><td>{keyword.adGroupName}</td><td>{campaignMarkets.get(structure.keywords.find((row) => row.id === keyword.id)?.campaignId ?? "") ?? "-"}</td><td>{keyword.matchType}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td><td>{formatMoney(keyword.bidAmount, keyword.currency)}</td><td>{keyword.intentLabel}</td><td>{keyword.duplicateCount}</td><td>{keyword.hasNegativeMatch ? "Yes" : "No"}</td><td>Not imported at keyword level</td>
      </tr>; }) : <tr><td colSpan={11}>No keywords imported yet.</td></tr>}</tbody>
    </table></div>

    <div className="section-head" id="search-terms"><h2>Search Terms</h2><span>{searchTerms.length ? `${searchTerms.length} imported` : "Awaiting importer support"}</span></div>
    {searchTerms.length ? <div className="table-wrap"><table>
      <thead><tr><th>Search term</th><th>Campaign</th><th>Ad group</th><th>Source keyword</th><th>Market</th><th>Date</th><th>Impressions</th><th>Taps</th><th>Installs</th><th>Spend</th><th>Intent</th><th>Product fit</th><th>Suggested action</th></tr></thead>
      <tbody>{searchTerms.map((term) => <tr key={term.id}>
        <td>{term.searchTerm}</td><td>{term.campaignName}</td><td>{term.adGroupName ?? "-"}</td><td>{term.sourceKeywordText ?? term.matchSource ?? "-"}</td><td>{term.country.toUpperCase()}</td><td>{term.metricDate}</td><td>{formatNumber(term.impressions)}</td><td>{formatNumber(term.taps)}</td><td>{formatNumber(term.installs)}</td><td>{formatMoney(term.spend, term.currency)}</td><td>{term.intentCluster ?? "-"}</td><td>{term.productFit ?? "-"}</td><td>{term.suggestedAction ?? "Review"}</td>
      </tr>)}</tbody>
    </table></div> : <section className="notice">
      <h2>No search-term rows imported yet</h2>
      <p>The storage and read model are ready, but the current Apple Ads reporting sync still stores only campaign-level daily metrics. A verified search-term importer can now persist actual queries into this view.</p>
    </section>}

    <div className="section-head" id="negatives"><h2>Negatives</h2><span>{structure.negativeKeywords.length >= 500 ? "Showing first 500" : `${structure.negativeKeywords.length} imported`}</span></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Negative term</th><th>Match</th><th>Scope</th><th>Campaign</th><th>Ad group</th><th>Status</th></tr></thead>
      <tbody>{structure.negativeKeywords.length ? structure.negativeKeywords.map((keyword) => { const status = formatAppleAdsEntityStatus(keyword.status); return <tr key={keyword.id}>
        <td>{keyword.keywordText}</td><td>{keyword.matchType ?? "-"}</td><td>{keyword.adGroupId ? "Ad group" : "Campaign"}</td><td>{campaignNames.get(keyword.campaignId) ?? "Campaign"}</td><td>{keyword.adGroupId ? adGroupNames.get(keyword.adGroupId) ?? "Ad group" : "-"}</td><td><span className={appleAdsStatusClass(status)}>{status.label}</span></td>
      </tr>; }) : <tr><td colSpan={6}>No negative keywords imported yet.</td></tr>}</tbody>
    </table></div>
  </PageShell>;
}
