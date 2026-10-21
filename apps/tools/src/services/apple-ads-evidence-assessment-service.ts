import { createHash } from "node:crypto";
import {
  APPLE_ADS_EVIDENCE_RULE_VERSION,
  assessAppleAdsEvidence,
  normalizeAppleAdsText,
  type AppleAdsEvidenceAssessment,
  type AppleAdsEvidenceRecommendation,
  type AssessmentInput,
  type DataCompleteness,
  type DataFreshness,
} from "../lib/apple-ads/evidence-assessment";
import { recommendationIdentity } from "../lib/recommendation-identity";
import { createAdminClient } from "../lib/supabase/admin";

const FRESHNESS_HOURS = 48;

type GenerationResult = {
  assessments: AppleAdsEvidenceAssessment[];
  activeRecommendations: number;
  inserted: number;
  updated: number;
  unchanged: number;
};

const numeric = (value: unknown) => Number(value ?? 0);
const latest = (values: Array<string | null | undefined>) => values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function appleAdsRecommendationDedupeKey(
  connectionId: string,
  assessment: AppleAdsEvidenceAssessment,
  recommendation: AppleAdsEvidenceRecommendation,
) {
  return recommendationIdentity({
    source: "apple_ads",
    scopeId: connectionId,
    appId: assessment.appId,
    market: assessment.storefront,
    kind: recommendation.type,
    targetType: recommendation.targetType,
    targetId: [
      recommendation.campaignId,
      recommendation.adGroupId ?? null,
      recommendation.keywordId ?? null,
    ].filter(Boolean).join(":"),
    targetText: normalizeAppleAdsText(recommendation.targetText),
  });
}

export function appleAdsEvidenceFingerprint(assessment: AppleAdsEvidenceAssessment) {
  return hash({
    ruleVersion: assessment.ruleVersion,
    evidenceWindow: assessment.evidenceWindow,
    dataFreshness: assessment.dataFreshness,
    dataCompleteness: assessment.dataCompleteness,
    trafficQuality: assessment.trafficQuality,
    conversionEvidence: assessment.conversionEvidence,
    totals: assessment.totals,
    recommendations: assessment.recommendations,
  });
}

function freshness(syncAt: string | null, now: string, completeness: DataCompleteness): DataFreshness {
  if (completeness === "partial") return "partial";
  if (!syncAt || Number.isNaN(Date.parse(syncAt))) return "stale";
  return Date.parse(now) - Date.parse(syncAt) <= FRESHNESS_HOURS * 3_600_000 ? "fresh" : "stale";
}

async function buildAssessmentInputs(input: {
  connectionId: string;
  campaignRowId: string;
  completeness: DataCompleteness;
  now: string;
}): Promise<AssessmentInput[]> {
  const db = createAdminClient();
  const { data: campaign, error: campaignError } = await db
    .from("apple_ads_campaigns")
    .select("id,app_id,name,status,currency,countries_or_regions")
    .eq("connection_id", input.connectionId)
    .eq("id", input.campaignRowId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (campaignError) throw new Error(`Could not resolve Apple Ads campaign assessment scope: ${campaignError.message}`);
  if (!campaign?.app_id) return [];

  const [{ data: app, error: appError }, { data: metrics, error: metricError }, { data: terms, error: termError }, { data: keywords, error: keywordError }, { data: negatives, error: negativeError }, { data: groups, error: groupError }] = await Promise.all([
    db.from("aso_apps").select("id,name").eq("id", campaign.app_id).maybeSingle(),
    db.from("apple_ads_daily_metrics").select("metric_date,country,impressions,taps,installs,spend,currency,source_synced_at").eq("connection_id", input.connectionId).eq("campaign_id", campaign.id).order("metric_date", { ascending: true }).limit(1000),
    db.from("apple_ads_search_terms").select("search_term,source_keyword_text,match_source,country,ad_group_id,keyword_id,impressions,taps,installs,spend,source_synced_at").eq("connection_id", input.connectionId).eq("campaign_id", campaign.id).order("metric_date", { ascending: true }).limit(1000),
    db.from("apple_ads_keywords").select("id,ad_group_id,keyword_text,match_type,status,is_deleted").eq("connection_id", input.connectionId).eq("campaign_id", campaign.id),
    db.from("apple_ads_negative_keywords").select("ad_group_id,keyword_text,match_type,status,is_deleted").eq("connection_id", input.connectionId).eq("campaign_id", campaign.id),
    db.from("apple_ads_ad_groups").select("id,search_match_enabled,status,is_deleted").eq("connection_id", input.connectionId).eq("campaign_id", campaign.id),
  ]);
  if (appError) throw new Error(`Could not resolve assessment app: ${appError.message}`);
  if (metricError) throw new Error(`Could not read campaign evidence: ${metricError.message}`);
  if (termError) throw new Error(`Could not read search-term evidence: ${termError.message}`);
  if (keywordError) throw new Error(`Could not read keyword evidence: ${keywordError.message}`);
  if (negativeError) throw new Error(`Could not read negative-keyword evidence: ${negativeError.message}`);
  if (groupError) throw new Error(`Could not read ad-group evidence: ${groupError.message}`);
  if (!app || !metrics?.length) return [];

  const configuredStorefronts = Array.isArray(campaign.countries_or_regions)
    ? campaign.countries_or_regions.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.toUpperCase())
    : [];
  const observedStorefronts = [...new Set((terms ?? []).map((row) => String(row.country ?? "").toUpperCase()).filter((value) => value && value !== "ALL"))];
  const storefronts = configuredStorefronts.length ? configuredStorefronts : observedStorefronts;
  if (!storefronts.length) return [];

  return storefronts.map((storefront) => {
    const scopedMetrics = metrics.filter((row) => String(row.country ?? "all").toUpperCase() === storefront || String(row.country ?? "all").toLowerCase() === "all");
    const scopedTerms = (terms ?? []).filter((row) => String(row.country ?? "all").toUpperCase() === storefront || String(row.country ?? "all").toLowerCase() === "all");
    const dates = scopedMetrics.map((row) => row.metric_date).sort();
    const metricSync = latest(scopedMetrics.map((row) => row.source_synced_at));
    const termSync = latest(scopedTerms.map((row) => row.source_synced_at));
    const sourceSync = metricSync && termSync
      ? (Date.parse(metricSync) <= Date.parse(termSync) ? metricSync : termSync)
      : metricSync ?? termSync;
    const totals = scopedMetrics.reduce((sum, row) => ({
      impressions: sum.impressions + numeric(row.impressions),
      taps: sum.taps + numeric(row.taps),
      installs: sum.installs + numeric(row.installs),
      spend: sum.spend + numeric(row.spend),
      currency: sum.currency ?? row.currency ?? campaign.currency ?? null,
    }), { impressions: 0, taps: 0, installs: 0, spend: 0, currency: null as string | null });
    return {
      appId: app.id,
      appName: app.name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      storefront,
      campaignStatus: campaign.status,
      evidenceWindow: { start: dates[0], end: dates.at(-1)! },
      generatedAt: input.now,
      dataFreshness: freshness(sourceSync, input.now, input.completeness),
      dataCompleteness: input.completeness,
      totals,
      searchTerms: scopedTerms.map((row) => ({
        searchTerm: row.search_term,
        sourceKeywordText: row.source_keyword_text,
        matchSource: row.match_source,
        adGroupId: row.ad_group_id,
        keywordId: row.keyword_id,
        impressions: numeric(row.impressions),
        taps: numeric(row.taps),
        installs: numeric(row.installs),
        spend: numeric(row.spend),
      })),
      keywords: (keywords ?? []).map((row) => ({
        id: row.id,
        adGroupId: row.ad_group_id,
        keywordText: row.keyword_text,
        matchType: row.match_type,
        status: row.status,
        isDeleted: Boolean(row.is_deleted),
      })),
      negativeKeywords: (negatives ?? []).map((row) => ({
        adGroupId: row.ad_group_id,
        keywordText: row.keyword_text,
        matchType: row.match_type,
        status: row.status,
        isDeleted: Boolean(row.is_deleted),
      })),
      adGroups: (groups ?? []).map((row) => ({
        id: row.id,
        searchMatchEnabled: row.search_match_enabled,
        status: row.status,
        isDeleted: Boolean(row.is_deleted),
      })),
    };
  });
}

async function persistAssessment(connectionId: string, assessment: AppleAdsEvidenceAssessment) {
  const db = createAdminClient();
  const fingerprint = appleAdsEvidenceFingerprint(assessment);
  const entries = assessment.recommendations.map((recommendation) => ({
    recommendation,
    dedupeKey: appleAdsRecommendationDedupeKey(connectionId, assessment, recommendation),
  }));
  if (!entries.length) {
    const { data: activeRows, error: activeError } = await db
      .from("apple_ads_recommendations")
      .select("id")
      .eq("connection_id", connectionId)
      .eq("app_id", assessment.appId)
      .eq("campaign_id", assessment.campaignId)
      .eq("storefront", assessment.storefront)
      .eq("status", "active");
    if (activeError) throw new Error(`Could not inspect obsolete Apple Ads recommendations: ${activeError.message}`);
    const ids = (activeRows ?? []).map((row) => row.id);
    if (ids.length) {
      const { error } = await db.from("apple_ads_recommendations").update({ status: "superseded", updated_at: assessment.generatedAt }).in("id", ids);
      if (error) throw new Error(`Could not supersede obsolete Apple Ads recommendations: ${error.message}`);
    }
    return { activeRecommendations: 0, inserted: 0, updated: 0, unchanged: 0 };
  }

  const { data: existingRows, error: existingError } = await db
    .from("apple_ads_recommendations")
    .select("id,dedupe_key,evidence_fingerprint,snapshot_id")
    .eq("connection_id", connectionId)
    .in("dedupe_key", entries.map((entry) => entry.dedupeKey));
  if (existingError) throw new Error(`Could not inspect existing Apple Ads recommendations: ${existingError.message}`);
  const existing = new Map((existingRows ?? []).map((row) => [row.dedupe_key, row]));
  const changed = entries.filter((entry) => existing.get(entry.dedupeKey)?.evidence_fingerprint !== fingerprint);

  let snapshotId = existingRows?.find((row) => row.evidence_fingerprint === fingerprint && row.snapshot_id)?.snapshot_id ?? null;
  if (changed.length && !snapshotId) {
    const { data: snapshot, error: snapshotError } = await db.from("apple_ads_decision_snapshots").insert({
      connection_id: connectionId,
      data_window: { ...assessment.evidenceWindow, storefront: assessment.storefront, campaign_id: assessment.campaignId },
      metrics: {
        totals: assessment.totals,
        trafficQuality: assessment.trafficQuality,
        conversionEvidence: assessment.conversionEvidence,
      },
      aso_context: {
        appId: assessment.appId,
        appName: assessment.appName,
        storefront: assessment.storefront,
        campaignId: assessment.campaignId,
        campaignName: assessment.campaignName,
        dataFreshness: assessment.dataFreshness,
        dataCompleteness: assessment.dataCompleteness,
        recommendations: assessment.recommendations,
        evidenceFingerprint: fingerprint,
      },
      model_version: "deterministic-evidence-assessment",
      rule_version: APPLE_ADS_EVIDENCE_RULE_VERSION,
    }).select("id").single();
    if (snapshotError) throw new Error(`Could not store immutable Apple Ads evidence snapshot: ${snapshotError.message}`);
    snapshotId = snapshot.id;
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  for (const { recommendation, dedupeKey } of entries) {
    const row = existing.get(dedupeKey);
    if (row?.evidence_fingerprint === fingerprint) {
      unchanged += 1;
      continue;
    }
    const payload = {
      connection_id: connectionId,
      app_id: assessment.appId,
      campaign_id: assessment.campaignId,
      ad_group_id: recommendation.adGroupId ?? null,
      keyword_id: recommendation.keywordId ?? null,
      storefront: assessment.storefront,
      target_type: recommendation.targetType,
      target_text: recommendation.targetText,
      recommendation_type: recommendation.type,
      source: "rules",
      status: "active",
      priority: recommendation.type === "ADD_NEGATIVE_EXACT" || recommendation.type === "REVIEW_BROAD_KEYWORD" ? "high" : "medium",
      confidence: recommendation.confidence === "high" ? 90 : recommendation.confidence === "medium" ? 65 : 35,
      financial_risk: recommendation.financialRisk === "high" ? 90 : recommendation.financialRisk === "medium" ? 60 : 20,
      title: recommendation.title,
      evidence_summary: recommendation.observation,
      deterministic_rationale: recommendation.diagnosis,
      observation: recommendation.observation,
      diagnosis: recommendation.diagnosis,
      proposed_action: recommendation.proposedAction,
      review_condition: recommendation.reviewCondition,
      evidence: recommendation.evidence,
      evidence_quality: recommendation.evidenceQuality,
      evidence_window: assessment.evidenceWindow,
      rule_version: assessment.ruleVersion,
      dedupe_key: dedupeKey,
      evidence_fingerprint: fingerprint,
      snapshot_id: snapshotId,
      generated_at: assessment.generatedAt,
      expires_at: null,
      updated_at: assessment.generatedAt,
    };
    const result = row
      ? await db.from("apple_ads_recommendations").update(payload).eq("id", row.id)
      : await db.from("apple_ads_recommendations").insert(payload);
    if (result.error) throw new Error(`Could not persist Apple Ads evidence recommendation: ${result.error.message}`);
    if (row) updated += 1;
    else inserted += 1;
  }

  const { data: older, error: olderError } = await db
    .from("apple_ads_recommendations")
    .select("id,dedupe_key")
    .eq("connection_id", connectionId)
    .eq("app_id", assessment.appId)
    .eq("campaign_id", assessment.campaignId)
    .eq("storefront", assessment.storefront)
    .eq("status", "active");
  if (olderError) throw new Error(`Could not inspect superseded Apple Ads recommendations: ${olderError.message}`);
  const currentKeys = new Set(entries.map((entry) => entry.dedupeKey));
  const supersededIds = (older ?? []).filter((row) => !currentKeys.has(row.dedupe_key)).map((row) => row.id);
  if (supersededIds.length) {
    const { error } = await db.from("apple_ads_recommendations").update({ status: "superseded", updated_at: assessment.generatedAt }).in("id", supersededIds);
    if (error) throw new Error(`Could not supersede older Apple Ads recommendations: ${error.message}`);
  }

  return { activeRecommendations: entries.length, inserted, updated, unchanged };
}

export async function generateAppleAdsEvidenceAssessment(input: {
  connectionId: string;
  campaignRowId: string;
  completeness?: DataCompleteness;
  now?: string;
}): Promise<GenerationResult> {
  const now = input.now ?? new Date().toISOString();
  const assessmentInputs = await buildAssessmentInputs({
    connectionId: input.connectionId,
    campaignRowId: input.campaignRowId,
    completeness: input.completeness ?? "complete",
    now,
  });
  const assessments = assessmentInputs.map(assessAppleAdsEvidence);
  const totals = { activeRecommendations: 0, inserted: 0, updated: 0, unchanged: 0 };
  for (const assessment of assessments) {
    const result = await persistAssessment(input.connectionId, assessment);
    totals.activeRecommendations += result.activeRecommendations;
    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }
  return { assessments, ...totals };
}
