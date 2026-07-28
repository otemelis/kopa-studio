import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { analyzeAppleAdsKeywordStructure, type KeywordSetupFinding } from "@/lib/apple-ads/keyword-structure-intelligence";
import { appleAdsStatusClass, formatAppleAdsEntityStatus } from "@/lib/apple-ads/status";
import { requireUser } from "@/lib/auth";
import { listAppleAdsSearchTerms } from "@/repositories/apple-ads-search-term-repository";
import { getAppleAdsStructure } from "@/repositories/apple-ads-structure-repository";
import { assessSearchTermRecommendation } from "@/services/apple-ads-recommendation-service";

export const dynamic = "force-dynamic";

const formatMoney = (value: number | null, currency: string | null) => value === null ? "-" : new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(value);
const findingStatus = (severity: KeywordSetupFinding["severity"]) => severity === "attention" ? "error" : severity === "warning" ? "waiting" : "configured";
const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export default async function AppleAdsKeywordIntelligencePage() {
  const user = await requireUser();
  const [structure, searchTerms] = await Promise.all([getAppleAdsStructure(user.id), listAppleAdsSearchTerms(user.id)]);
  const intelligence = analyzeAppleAdsKeywordStructure(structure);
  const adGroupNames = new Map(structure.adGroups.map((adGroup) => [adGroup.id, adGroup.name]));
  const campaignNames = new Map(structure.campaigns.map((campaign) => [campaign.id, campaign.name]));
  const campaignMarkets = new Map(structure.campaigns.map((campaign) => [campaign.id, campaign.countriesOrRegions.length ? campaign.countriesOrRegions.join(", ") : "-"]));
  const opportunities = intelligence.findings.filter((finding) => ["duplicates", "missing-negatives", "broad-only", "exact-only"].includes(finding.id));
  const exactKeywords = new Set(structure.keywords.filter((keyword) => /exact/i.test(keyword.matchType ?? "")).map((keyword) => `${keyword.campaignId}|${normalize(keyword.keywordText)}`));
  const exactNegatives = new Set(structure.negativeKeywords.filter((keyword) => /exact/i.test(keyword.matchType ?? "")).map((keyword) => `${keyword.campaignId}|${normalize(keyword.keywordText)}`));
  const groupedTerms = new Map<string, { campaignId: string; campaignName: string; term: string; sourceKeywordText: string | null; countries: Set<string>; dates: Set<string>; impressions: number; taps: number; installs: number; spend: number; currency: string | null; latestSync: string | null }>();
  for (const term of searchTerms) {
    const key = `${term.campaignId}|${normalize(term.searchTerm)}`;
    const current = groupedTerms.get(key) ?? { campaignId: term.campaignId, campaignName: term.campaignName, term: term.searchTerm, sourceKeywordText: term.sourceKeywordText, countries: new Set<string>(), dates: new Set<string>(), impressions: 0, taps: 0, installs: 0, spend: 0, currency: term.currency, latestSync: null };
    current.impressions += term.impressions; current.taps += term.taps; current.installs += term.installs; current.spend += term.spend;
    current.countries.add(term.country.toUpperCase()); current.dates.add(term.metricDate);
    if (!current.sourceKeywordText && term.sourceKeywordText) current.sourceKeywordText = term.sourceKeywordText;
    if (!current.latestSync || (term.sourceSyncedAt && term.sourceSyncedAt > current.latestSync)) current.latestSync = term.sourceSyncedAt;
    groupedTerms.set(key, current);
  }
  const searchTermEvidence = [...groupedTerms.values()].map((term) => ({
    ...term,
    assessment: assessSearchTermRecommendation({ term: term.term, appName: null, campaignName: term.campaignName, sourceKeywordText: term.sourceKeywordText, impressions: term.impressions, taps: term.taps, installs: term.installs, spend: term.spend, fresh: term.latestSync ? Date.now() - Date.parse(term.latestSync) < 48 * 60 * 60 * 1000 : false, partialSync: false, isControlledExact: exactKeywords.has(`${term.campaignId}|${normalize(term.term)}`), isNegative: exactNegatives.has(`${term.campaignId}|${normalize(term.term)}`) }),
  })).sort((left, right) => right.impressions - left.impressions);
  const eligibleSearchTerms = searchTermEvidence.filter((term) => term.assessment.recommendation).length;

  return <PageShell title="Keywords & Search Terms">
    <section className="notice">
      <h2>Paid keyword workspace</h2>
      <p>Imported target keywords, negatives, and setup opportunities. Search terms will appear here once the reporting importer stores search-term rows.</p>
    </section>

    <section className="metric-grid">
      <article className="metric-card"><p>Targeted keywords</p><strong>{intelligence.summary.keywords}</strong><small>Imported target rows</small></article>
      <article className="metric-card"><p>Negatives</p><strong>{structure.negativeKeywords.length}</strong><small>Imported negative rows</small></article>
      <article className="metric-card"><p>Search terms</p><strong>{searchTermEvidence.length}</strong><small>{searchTerms.length ? `${searchTerms.length} imported rows · ${eligibleSearchTerms} eligible` : "Awaiting importer support"}</small></article>
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

    <div className="section-head" id="search-terms"><h2>Search Terms</h2><span>{searchTerms.length ? `${searchTermEvidence.length} unique queries · ${eligibleSearchTerms} eligible` : "Awaiting importer support"}</span></div>
    {searchTerms.length ? <><section className="notice"><h2>Recommendation coverage</h2><p>Kopa evaluates fresh imported queries only. Each row below shows why it is ready for a read-only recommendation or why it is withheld; this is separate from Apple Ads’ own recommendations.</p></section><div className="table-wrap"><table>
      <thead><tr><th>Search term</th><th>Campaign</th><th>Source keyword</th><th>Markets</th><th>Dates</th><th>Impressions</th><th>Taps</th><th>Installs</th><th>Spend</th><th>Kopa decision</th></tr></thead>
      <tbody>{searchTermEvidence.map((term) => <tr key={`${term.campaignId}-${term.term}`}>
        <td>{term.term}</td><td>{term.campaignName}</td><td>{term.sourceKeywordText ?? "-"}</td><td>{[...term.countries].sort().join(", ")}</td><td>{[...term.dates].sort().join(", ")}</td><td>{formatNumber(term.impressions)}</td><td>{formatNumber(term.taps)}</td><td>{formatNumber(term.installs)}</td><td>{formatMoney(term.spend, term.currency)}</td><td>{term.assessment.reason}</td>
      </tr>)}</tbody>
    </table></div></> : <section className="notice">
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
