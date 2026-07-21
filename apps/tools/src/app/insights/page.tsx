import { PageShell } from "@/components/page-shell";
import { listApps } from "@/repositories/apps-repository";
import { loadInsights } from "@/services/insight-service";
import { requireUser } from "@/lib/auth";
import { RecommendationFeed, type RecommendationFeedItem } from "@/components/recommendation-feed";
import { listAppleAdsRecommendations } from "@/repositories/apple-ads-recommendation-repository";
import { applyRecommendationQuality } from "@/lib/recommendation-quality";

export const dynamic = "force-dynamic";
const priorityScore = (value: string) => value === "high" ? 0 : value === "medium" ? 1 : 2;
const clean = (value: string) => value.replace(/_/g, "-");

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ app?: string; priority?: string; source?: string }> }) {
  const user = await requireUser(); const filters = await searchParams; const [apps, insights, appleAds] = await Promise.all([listApps(), loadInsights({ appId: filters.app, priority: filters.priority, limit: 100 }), listAppleAdsRecommendations(user.id)]);
  const asoItems: RecommendationFeedItem[] = insights.map((insight) => { const quality = applyRecommendationQuality({ title: insight.title, observation: insight.observation, recommendation: insight.recommendation, evidence: insight.ruleId, actionable: true, status: "New" }); return { id: insight.id, source: "ASO", appName: insight.appName, title: insight.title, whatHappened: insight.observation, suggestedAction: quality.suggestedAction, evidence: quality.evidence, priority: insight.priority, confidence: clean(insight.confidence), impact: insight.impact, effort: insight.effort, risk: "None recorded", status: quality.status, createdAt: insight.createdAt, actionable: quality.actionable }; });
  const appleAdsItems: RecommendationFeedItem[] = appleAds.filter((row) => !filters.app || row.appId === filters.app).filter((row) => !filters.priority || row.priority === filters.priority).map((row) => ({ id: row.id, source: "Apple Ads", appName: row.appName, title: row.title, whatHappened: row.type, suggestedAction: row.type.replace(/_/g, " ").toLowerCase(), evidence: row.evidence, priority: row.priority, confidence: `${row.confidence}/100`, impact: "Paid acquisition", effort: "Review", risk: `${row.risk}/100`, status: row.status, createdAt: row.createdAt, actionable: false }));
  const items = [...asoItems, ...appleAdsItems].filter((item) => !filters.source || item.source === filters.source).sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <PageShell title="Recommendations"><form className="filter-form"><select name="app" defaultValue={filters.app ?? ""}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select><select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option><option value="ASO">ASO</option><option value="Apple Ads">Apple Ads</option></select><select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><button type="submit">Apply filters</button></form><RecommendationFeed items={items} /></PageShell>;
}
