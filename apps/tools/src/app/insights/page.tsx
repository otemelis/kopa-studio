import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadInsights } from "@/services/insight-service";
import { requireUser } from "@/lib/auth";
import { RecommendationFeed, type RecommendationFeedItem } from "@/components/recommendation-feed";
import { listAppleAdsRecommendations } from "@/repositories/apple-ads-recommendation-repository";
import { applyRecommendationQuality } from "@/lib/recommendation-quality";
import { loadStorefrontMetricSummaries } from "@/services/storefront-metrics-service";

export const dynamic = "force-dynamic";
const priorityScore = (value: string) => value === "high" ? 0 : value === "medium" ? 1 : 2;
const clean = (value: string) => value.replace(/_/g, "-");
const discoveryPriority = (severity: string) => severity === "attention" ? "high" : severity === "opportunity" ? "medium" : "low";
const discoveryStatus = (severity: string) => severity === "waiting" ? "Waiting" : "Review";
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

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ app?: string; priority?: string; source?: string }> }) {
  const user = await requireUser(); const filters = await searchParams; const [apps, insights, appleAds, discovery] = await Promise.all([listApps(), loadInsights({ appId: filters.app, priority: filters.priority, limit: 100 }), listAppleAdsRecommendations(user.id), loadStorefrontMetricSummaries(28, filters.app)]);
  const asoItems: RecommendationFeedItem[] = insights.map((insight) => { const quality = applyRecommendationQuality({ title: insight.title, observation: insight.observation, recommendation: insight.recommendation, evidence: insight.ruleId, actionable: true, status: "New" }); return { id: insight.id, source: "ASO", appName: insight.appName, title: insight.title, whatHappened: insight.observation, suggestedAction: quality.suggestedAction, evidence: quality.evidence, priority: insight.priority, confidence: clean(insight.confidence), impact: insight.impact, effort: insight.effort, risk: "None recorded", status: quality.status, createdAt: insight.createdAt, actionable: quality.actionable }; });
  const appleAdsItems: RecommendationFeedItem[] = appleAds.filter((row) => !filters.app || row.appId === filters.app).filter((row) => !filters.priority || row.priority === filters.priority).map((row) => ({ id: row.id, source: "Apple Ads", appName: row.appName, title: row.title, whatHappened: row.type, suggestedAction: row.type.replace(/_/g, " ").toLowerCase(), evidence: row.evidence, priority: row.priority, confidence: `${row.confidence}/100`, impact: "Paid acquisition", effort: "Review", risk: `${row.risk}/100`, status: row.status, createdAt: row.createdAt, actionable: false }));
  const discoveryCreatedAt = discovery.daily.at(-1)?.date ? `${discovery.daily.at(-1)?.date}T00:00:00.000Z` : new Date(0).toISOString();
  const discoveryItems: RecommendationFeedItem[] = discovery.opportunities.map((item, index) => ({ id: `discovery:${index}:${item.title}`, source: "Discovery", appName: item.appName ?? null, title: item.title, whatHappened: item.detail, suggestedAction: item.severity === "waiting" ? "Complete the data import before drawing a conclusion." : "Review the linked App Store Connect trend before changing metadata or acquisition spend.", evidence: "App Store Connect Discovery & Engagement, 28-day storefront window", priority: discoveryPriority(item.severity), confidence: item.severity === "waiting" ? "waiting" : "directional", impact: item.country ? `Storefront ${item.country.toUpperCase()}` : "Organic visibility", effort: "Review", risk: "No provider write action", status: discoveryStatus(item.severity), createdAt: discoveryCreatedAt, actionable: false, followUpHref: discoveryExperimentHref(item), followUpLabel: item.appId ? "Log investigation" : undefined }));
  const items = [...asoItems, ...discoveryItems, ...appleAdsItems].filter((item) => !filters.source || item.source === filters.source).filter((item) => !filters.priority || item.priority === filters.priority).sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <PageShell title="Recommendations"><form className="filter-form"><select name="app" defaultValue={filters.app ?? ""}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option><option value="ASO">ASO</option><option value="Discovery">Discovery</option><option value="Apple Ads">Apple Ads</option></select><select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button type="submit">Apply filters</button></form><RecommendationFeed items={items} /></PageShell>;
}
