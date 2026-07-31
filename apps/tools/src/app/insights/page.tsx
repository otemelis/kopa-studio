import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadInsights } from "@/services/insight-service";
import { requireUser } from "@/lib/auth";
import { RecommendationFeed, type RecommendationFeedItem } from "@/components/recommendation-feed";
import { listAppleAdsRecommendations } from "@/repositories/apple-ads-recommendation-repository";
import { applyRecommendationQuality } from "@/lib/recommendation-quality";
import { loadStorefrontMetricSummaries } from "@/services/storefront-metrics-service";
import { matchesRecommendationScope } from "@/lib/recommendation-scope";
import { resolveDiscoveryPeriod } from "@/lib/discovery-period";
import { formatDiscoveryEvidenceSufficiency } from "@/lib/discovery-sufficiency";
import { formatAsoInsightEvidence } from "@/lib/aso-insight-evidence";
import { appleAdsAgreementEvidence, assessCrossSourceAgreement, discoveryAgreementEvidence, formatCrossSourceAgreement } from "@/lib/cross-source-agreement";

export const dynamic = "force-dynamic";
const priorityScore = (value: string) => value === "high" ? 0 : value === "medium" ? 1 : 2;
const clean = (value: string) => value.replace(/_/g, "-");
const discoveryPriority = (severity: string) => severity === "attention" ? "high" : severity === "opportunity" ? "medium" : "low";
const discoveryStatus = (severity: string) => severity === "waiting" ? "Waiting" : "Review";
const discoverySuggestedAction = (item: { severity: string; title: string }) =>
  item.title === "Waiting for download import"
    ? "Complete the separate sales/download import before judging product-page conversion."
    : item.severity === "waiting"
      ? "Refresh or extend the scoped Discovery import until the selected period is decision-ready."
      : "Review the linked App Store Connect trend before changing metadata or acquisition spend.";
const discoveryMetric = (title: string) => title.includes("page views are not converting") ? "conversion" : title.includes("page-view pull") || title.includes("page views") ? "page_views" : "impressions";
function discoveryExperimentHref(item: { appId?: string; country?: string; title: string; detail: string }) {
  if (!item.appId) return undefined;
  const params = new URLSearchParams({
    app: item.appId,
    market: item.country ?? "all",
    title: `Investigate ${item.title}`,
    description: item.detail,
    changeType: "metadata",
    targetMetric: discoveryMetric(item.title),
    nextAction: "Review App Store Connect trend, decide whether to update metadata, screenshots, localization, or acquisition pacing.",
  });
  return `/experiments?${params.toString()}`;
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ app?: string; country?: string; period?: string; priority?: string; source?: string }> }) {
  const user = await requireUser(); const filters = await searchParams; const { period, days } = resolveDiscoveryPeriod(filters.period); const scope = { appId: filters.app, country: filters.country }; const [apps, insights, appleAds, discovery] = await Promise.all([listApps(), loadInsights({ appId: filters.app, country: filters.country, priority: filters.priority, limit: 100 }), listAppleAdsRecommendations(user.id, { appId: filters.app, country: filters.country }), loadStorefrontMetricSummaries(days, filters.app, filters.country)]);
  const selectedAppName = filters.app ? apps.find((app) => app.id === filters.app)?.name ?? null : null;
  const crossSourceAgreement = assessCrossSourceAgreement({
    discovery: discoveryAgreementEvidence({
      appId: filters.app,
      market: filters.country,
      observedWindow: discovery.sufficiency.observedWindow,
      freshness: discovery.sufficiency.freshness.state,
      completeness: discovery.sufficiency.completeness.state,
      volume: discovery.sufficiency.volume.state,
      impressions: discovery.totals.impressions,
      impressionToPageRate: discovery.totals.impressionToPageRate,
      hasDailyRows: discovery.hasDailyRows,
    }),
    appleAds: appleAdsAgreementEvidence({ appId: filters.app, market: filters.country, rows: appleAds }),
  });
  const sharedRecommendationContext = { crossSourceAgreement: formatCrossSourceAgreement(crossSourceAgreement) };
  const asoItems: RecommendationFeedItem[] = insights.map((insight) => { const quality = applyRecommendationQuality({ title: insight.title, observation: insight.observation, recommendation: insight.recommendation, evidence: formatAsoInsightEvidence(insight), actionable: true, status: "New" }); return { id: insight.id, appId: insight.appId, market: insight.country, source: "ASO", appName: insight.appName, title: insight.title, whatHappened: insight.observation, suggestedAction: quality.suggestedAction, evidence: quality.evidence, ...sharedRecommendationContext, priority: insight.priority, confidence: clean(insight.confidence), impact: insight.impact, effort: insight.effort, risk: "None recorded", status: quality.status, createdAt: insight.createdAt, actionable: quality.actionable }; });
  const appleAdsItems: RecommendationFeedItem[] = appleAds.filter((row) => !filters.priority || row.priority === filters.priority).map((row) => ({ id: row.id, appId: row.appId, market: row.storefront, source: "Apple Ads", appName: row.appName, title: row.title, whatHappened: row.observation, suggestedAction: row.proposedAction, evidence: row.evidence ? `${row.evidence.impressions} impressions, ${row.evidence.taps} taps, ${row.evidence.installs} installs, ${row.evidence.spend} ${row.evidence.currency ?? ""} · ${row.storefront ?? "unknown market"} · ${row.evidenceWindow ? `${row.evidenceWindow.start} to ${row.evidenceWindow.end}` : "window unavailable"}` : row.observation, ...sharedRecommendationContext, priority: row.priority, confidence: row.evidenceQuality?.confidence ?? `${row.confidence}/100`, impact: "Paid acquisition", effort: "Review", risk: `${row.risk}/100`, status: row.status, createdAt: row.createdAt, actionable: false, followUpHref: "/apple-ads-lab/recommendations", followUpLabel: "Open evidence" }));
  const discoveryCreatedAt = discovery.daily.at(-1)?.date ? `${discovery.daily.at(-1)?.date}T00:00:00.000Z` : new Date(0).toISOString();
  const discoveryItems: RecommendationFeedItem[] = discovery.opportunities.map((item, index) => ({ id: `discovery:${period}:${index}:${item.title}`, appId: item.appId ?? filters.app ?? null, market: item.country ?? filters.country ?? null, source: "Discovery", appName: item.appName ?? selectedAppName, title: item.title, whatHappened: item.detail, suggestedAction: discoverySuggestedAction(item), evidence: formatDiscoveryEvidenceSufficiency(discovery.sufficiency), ...sharedRecommendationContext, priority: discoveryPriority(item.severity), confidence: item.severity === "waiting" ? "waiting" : discovery.sufficiency.volume.state, impact: item.country ? `Storefront ${item.country.toUpperCase()}` : "Organic visibility", effort: "Review", risk: "No provider write action", status: discoveryStatus(item.severity), createdAt: discoveryCreatedAt, actionable: false, followUpHref: item.severity === "waiting" ? "/app-store-connect" : discoveryExperimentHref(item), followUpLabel: item.severity === "waiting" ? "Open data quality" : item.appId ? "Log investigation" : undefined }));
  const items = [...asoItems, ...discoveryItems, ...appleAdsItems].filter((item) => matchesRecommendationScope(item, scope)).filter((item) => !filters.source || item.source === filters.source).filter((item) => !filters.priority || item.priority === filters.priority).sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <PageShell title="Recommendations"><form className="filter-form"><input type="hidden" name="country" value={filters.country ?? ""} /><input type="hidden" name="period" value={period} /><select name="app" defaultValue={filters.app ?? ""}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option><option value="ASO">ASO</option><option value="Discovery">Discovery</option><option value="Apple Ads">Apple Ads</option></select><select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button type="submit">Apply filters</button></form>{filters.country ? <p className="data-note">Exact market scope: {filters.country.toUpperCase()}. Portfolio and other-market recommendations are excluded.</p> : null}<RecommendationFeed items={items} /></PageShell>;
}
