import { createAdminClient } from "@/lib/supabase/admin";
import type { EvidenceQuality } from "@/lib/apple-ads/evidence-assessment";

export type AppleAdsRecommendationRow = {
  id: string;
  type: string;
  status: string;
  priority: string;
  confidence: number;
  risk: number;
  title: string;
  observation: string;
  diagnosis: string;
  proposedAction: string;
  reviewCondition: string;
  evidence: {
    impressions: number;
    taps: number;
    installs: number;
    spend: number;
    currency: string | null;
    sourceKeyword?: string;
    matchType?: string;
  } | null;
  evidenceQuality: EvidenceQuality | null;
  evidenceWindow: { start: string; end: string } | null;
  storefront: string | null;
  targetType: string | null;
  targetText: string | null;
  createdAt: string;
  appId: string | null;
  appName: string | null;
};

export type AppleAdsCampaignDiagnosis = {
  snapshotId: string;
  appId: string | null;
  appName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  storefront: string | null;
  evidenceWindow: { start: string; end: string } | null;
  generatedAt: string;
  dataFreshness: string;
  dataCompleteness: string;
  trafficQuality: { state: string; confidence: string; explanation: string } | null;
  conversionEvidence: { state: string; tapCount: number; installCount: number; threshold: number; explanation: string } | null;
  totals: { impressions: number; taps: number; installs: number; spend: number; currency: string | null } | null;
};

export type AppleAdsRecommendationFilters = {
  appId?: string;
  country?: string;
};

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : null;
const number = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0);

export async function getAppleAdsRecommendationData(ownerUserId: string, filters: AppleAdsRecommendationFilters = {}): Promise<{ rows: AppleAdsRecommendationRow[]; diagnoses: AppleAdsCampaignDiagnosis[] }> {
  const db = createAdminClient();
  const { data: connections, error: connectionError } = await db.from("apple_ads_connections").select("id").eq("owner_user_id", ownerUserId);
  if (connectionError) throw new Error("Could not read Apple Ads connections.");
  const ids = (connections ?? []).map((connection) => connection.id);
  if (!ids.length) return { rows: [], diagnoses: [] };

  let query = db
    .from("apple_ads_recommendations")
    .select("id,recommendation_type,status,priority,confidence,financial_risk,title,evidence_summary,deterministic_rationale,observation,diagnosis,proposed_action,review_condition,evidence,evidence_quality,evidence_window,storefront,target_type,target_text,generated_at,app_id,snapshot_id")
    .in("connection_id", ids)
    .eq("status", "active");
  if (filters.appId) query = query.eq("app_id", filters.appId);
  if (filters.country && filters.country.toLowerCase() !== "all") query = query.eq("storefront", filters.country.toUpperCase());
  const { data, error } = await query.order("generated_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not read Apple Ads recommendations.");

  const appIds = [...new Set((data ?? []).map((row) => row.app_id).filter((value): value is string => Boolean(value)))];
  const snapshotIds = [...new Set((data ?? []).map((row) => row.snapshot_id).filter((value): value is string => Boolean(value)))];
  const [{ data: apps, error: appError }, { data: snapshots, error: snapshotError }] = await Promise.all([
    appIds.length ? db.from("aso_apps").select("id,name").in("id", appIds) : { data: [], error: null },
    snapshotIds.length ? db.from("apple_ads_decision_snapshots").select("id,data_window,metrics,aso_context,created_at").in("id", snapshotIds) : { data: [], error: null },
  ]);
  if (appError) throw new Error("Could not resolve Apple Ads recommendation apps.");
  if (snapshotError) throw new Error("Could not read Apple Ads evidence snapshots.");
  const names = new Map((apps ?? []).map((app) => [app.id, app.name]));

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    type: row.recommendation_type,
    status: row.status,
    priority: row.priority,
    confidence: row.confidence,
    risk: row.financial_risk,
    title: row.title,
    observation: row.observation ?? row.evidence_summary,
    diagnosis: row.diagnosis ?? row.deterministic_rationale ?? "",
    proposedAction: row.proposed_action ?? row.recommendation_type.replace(/_/g, " ").toLowerCase(),
    reviewCondition: row.review_condition ?? "Review when the evidence window changes.",
    evidence: row.evidence as AppleAdsRecommendationRow["evidence"],
    evidenceQuality: row.evidence_quality as EvidenceQuality | null,
    evidenceWindow: row.evidence_window as AppleAdsRecommendationRow["evidenceWindow"],
    storefront: row.storefront,
    targetType: row.target_type,
    targetText: row.target_text,
    createdAt: row.generated_at,
    appId: row.app_id ?? null,
    appName: row.app_id ? names.get(row.app_id) ?? null : null,
  }));

  const diagnosisByScope = new Map<string, AppleAdsCampaignDiagnosis>();
  for (const snapshot of snapshots ?? []) {
    const context = object(snapshot.aso_context);
    const metrics = object(snapshot.metrics);
    const totals = object(metrics.totals);
    const traffic = object(metrics.trafficQuality);
    const conversion = object(metrics.conversionEvidence);
    const window = object(snapshot.data_window);
    const diagnosis: AppleAdsCampaignDiagnosis = {
      snapshotId: snapshot.id,
      appId: text(context.appId),
      appName: text(context.appName),
      campaignId: text(context.campaignId) ?? text(window.campaign_id),
      campaignName: text(context.campaignName),
      storefront: text(context.storefront) ?? text(window.storefront),
      evidenceWindow: text(window.start) && text(window.end) ? { start: text(window.start)!, end: text(window.end)! } : null,
      generatedAt: snapshot.created_at,
      dataFreshness: text(context.dataFreshness) ?? "unknown",
      dataCompleteness: text(context.dataCompleteness) ?? "unknown",
      trafficQuality: text(traffic.state) ? { state: text(traffic.state)!, confidence: text(traffic.confidence) ?? "unknown", explanation: text(traffic.explanation) ?? "" } : null,
      conversionEvidence: text(conversion.state) ? {
        state: text(conversion.state)!,
        tapCount: number(conversion.tapCount),
        installCount: number(conversion.installCount),
        threshold: number(conversion.threshold),
        explanation: text(conversion.explanation) ?? "",
      } : null,
      totals: Object.keys(totals).length ? {
        impressions: number(totals.impressions),
        taps: number(totals.taps),
        installs: number(totals.installs),
        spend: number(totals.spend),
        currency: text(totals.currency),
      } : null,
    };
    const key = `${diagnosis.campaignId}:${diagnosis.storefront}`;
    const current = diagnosisByScope.get(key);
    if (!current || Date.parse(diagnosis.generatedAt) > Date.parse(current.generatedAt)) diagnosisByScope.set(key, diagnosis);
  }

  return { rows, diagnoses: [...diagnosisByScope.values()] };
}

export async function listAppleAdsRecommendations(ownerUserId: string, filters: AppleAdsRecommendationFilters = {}) {
  return (await getAppleAdsRecommendationData(ownerUserId, filters)).rows;
}
