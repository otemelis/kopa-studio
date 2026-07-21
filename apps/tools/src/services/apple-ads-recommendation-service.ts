import { createAdminClient } from "@/lib/supabase/admin";
import { evidenceConfidence, evidenceStage, financialRisk, opportunityScore } from "../lib/apple-ads/low-volume-model";
import { recommend, type RecommendationType } from "../lib/apple-ads/recommendation-rules";

const MODEL_VERSION = "low-volume-search-term-v1";
const RULE_VERSION = "deterministic-rules-v1";
const LEARNING_CAP = 25;

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const tokens = (value: string | null | undefined) => normalize(value ?? "").split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
const hasSharedToken = (a: string | null | undefined, b: string | null | undefined) => {
  const left = new Set(tokens(a));
  return tokens(b).some((token) => left.has(token));
};

export type KeywordRecommendationInput = {
  term: string;
  relevance: number;
  demand: number;
  organicGap: number;
  impressions: number;
  taps: number;
  installs: number;
  spend: number;
  learningCap: number;
  fresh: boolean;
  partialSync: boolean;
  isControlledExact?: boolean;
  isNegative?: boolean;
  protectedTerm?: boolean;
  recentBidChange?: boolean;
};

export type SearchTermRecommendationInput = {
  term: string;
  appName: string | null;
  campaignName: string | null;
  sourceKeywordText: string | null;
  impressions: number;
  taps: number;
  installs: number;
  spend: number;
  fresh: boolean;
  partialSync: boolean;
  isControlledExact: boolean;
  isNegative: boolean;
};

export type BuiltSearchTermRecommendation = {
  type: RecommendationType;
  priority: "low" | "medium" | "high";
  confidence: number;
  financialRisk: number;
  opportunity: number;
  title: string;
  evidenceSummary: string;
  deterministicRationale: string;
};

export function estimateSearchTermRelevance(input: Pick<SearchTermRecommendationInput, "term" | "appName" | "campaignName" | "sourceKeywordText" | "taps" | "installs">) {
  let score = 35;
  if (hasSharedToken(input.term, input.sourceKeywordText)) score += 30;
  if (hasSharedToken(input.term, input.appName)) score += 20;
  if (hasSharedToken(input.term, input.campaignName)) score += 10;
  if (input.taps > 0) score += 5;
  if (input.installs > 0) score += 15;
  return Math.max(0, Math.min(100, score));
}

export function buildKeywordRecommendation(input: KeywordRecommendationInput) {
  const evidence = evidenceStage({ ...input, postInstallEvents: 0 });
  const confidence = evidenceConfidence(input);
  const risk = financialRisk(input.spend, input.learningCap);
  const type = recommend({
    relevance: input.relevance,
    confidence,
    financialRisk: risk,
    evidence,
    isControlledExact: input.isControlledExact ?? false,
    isNegative: input.isNegative ?? false,
    spend: input.spend,
    learningCap: input.learningCap,
    fresh: input.fresh,
    partialSync: input.partialSync,
    protectedTerm: input.protectedTerm ?? false,
    recentBidChange: input.recentBidChange ?? false,
  });
  return {
    type,
    confidence,
    financialRisk: risk,
    opportunity: opportunityScore({ relevance: input.relevance, demand: input.demand, conversionPosterior: input.installs > 0 ? input.installs / Math.max(1, input.taps) : 0, organicGap: input.organicGap }),
    evidence,
  };
}

export function buildSearchTermRecommendation(input: SearchTermRecommendationInput): BuiltSearchTermRecommendation | null {
  const relevance = estimateSearchTermRelevance(input);
  const demand = Math.min(100, Math.round(Math.log1p(input.impressions) * 18));
  const result = buildKeywordRecommendation({
    term: input.term,
    relevance,
    demand,
    organicGap: 50,
    impressions: input.impressions,
    taps: input.taps,
    installs: input.installs,
    spend: input.spend,
    learningCap: LEARNING_CAP,
    fresh: input.fresh,
    partialSync: input.partialSync,
    isControlledExact: input.isControlledExact,
    isNegative: input.isNegative,
  });
  if (result.type !== "ADD_EXACT_KEYWORD" && result.type !== "ADD_NEGATIVE_EXACT") return null;
  const priority = result.opportunity >= 75 || input.installs > 0 ? "high" : input.taps > 0 ? "medium" : "low";
  const title = result.type === "ADD_EXACT_KEYWORD" ? `Add "${input.term}" as an exact keyword` : `Add "${input.term}" as a negative exact`;
  const evidenceSummary = `${input.impressions} impressions, ${input.taps} taps, ${input.installs} installs, ${input.spend.toFixed(2)} spend. Evidence stage: ${result.evidence}.`;
  const deterministicRationale = result.type === "ADD_EXACT_KEYWORD"
    ? "Imported Apple Ads search-term evidence suggests this uncontrolled term is relevant enough to prepare exact-match coverage. No Apple Ads change is made automatically."
    : "Imported Apple Ads search-term evidence suggests this term may be poor fit. No Apple Ads change is made automatically.";
  return { type: result.type, priority, confidence: result.confidence, financialRisk: result.financialRisk, opportunity: result.opportunity, title, evidenceSummary, deterministicRationale };
}

export async function generateSearchTermRecommendations(input: { connectionId: string; campaignRowId: string }) {
  const db = createAdminClient();
  const { data: campaign, error: campaignError } = await db.from("apple_ads_campaigns").select("id,app_id,name").eq("id", input.campaignRowId).maybeSingle();
  if (campaignError) throw new Error(`Could not resolve Apple Ads campaign for recommendations: ${campaignError.message}`);
  if (!campaign) return { generated: 0 };

  const [{ data: appRows, error: appError }, { data: terms, error: termError }, { data: keywords, error: keywordError }, { data: negatives, error: negativeError }] = await Promise.all([
    campaign.app_id ? db.from("aso_apps").select("id,name").eq("id", campaign.app_id).limit(1) : { data: [], error: null },
    db.from("apple_ads_search_terms").select("search_term,source_keyword_text,impressions,taps,installs,spend,source_synced_at,raw_payload").eq("connection_id", input.connectionId).eq("campaign_id", input.campaignRowId).order("metric_date", { ascending: false }).limit(1000),
    db.from("apple_ads_keywords").select("keyword_text,match_type").eq("connection_id", input.connectionId).eq("campaign_id", input.campaignRowId).eq("is_deleted", false),
    db.from("apple_ads_negative_keywords").select("keyword_text,match_type").eq("connection_id", input.connectionId).eq("campaign_id", input.campaignRowId).eq("is_deleted", false),
  ]);
  if (appError) throw new Error(`Could not resolve app context for recommendations: ${appError.message}`);
  if (termError) throw new Error(`Could not read Apple Ads search terms for recommendations: ${termError.message}`);
  if (keywordError) throw new Error(`Could not read Apple Ads keywords for recommendations: ${keywordError.message}`);
  if (negativeError) throw new Error(`Could not read Apple Ads negatives for recommendations: ${negativeError.message}`);

  const exactKeywords = new Set((keywords ?? []).filter((keyword) => /exact/i.test(keyword.match_type ?? "")).map((keyword) => normalize(keyword.keyword_text)));
  const exactNegatives = new Set((negatives ?? []).filter((keyword) => /exact/i.test(keyword.match_type ?? "")).map((keyword) => normalize(keyword.keyword_text)));
  const appName = appRows?.[0]?.name ?? null;
  const grouped = new Map<string, { term: string; sourceKeywordText: string | null; impressions: number; taps: number; installs: number; spend: number; latestSync: string | null }>();
  for (const row of terms ?? []) {
    const key = normalize(row.search_term);
    const current = grouped.get(key) ?? { term: row.search_term, sourceKeywordText: row.source_keyword_text, impressions: 0, taps: 0, installs: 0, spend: 0, latestSync: null };
    current.impressions += Number(row.impressions ?? 0);
    current.taps += Number(row.taps ?? 0);
    current.installs += Number(row.installs ?? 0);
    current.spend += Number(row.spend ?? 0);
    if (!current.sourceKeywordText && row.source_keyword_text) current.sourceKeywordText = row.source_keyword_text;
    if (!current.latestSync || Date.parse(row.source_synced_at) > Date.parse(current.latestSync)) current.latestSync = row.source_synced_at;
    grouped.set(key, current);
  }

  let generated = 0;
  for (const aggregate of grouped.values()) {
    const normalizedTerm = normalize(aggregate.term);
    const built = buildSearchTermRecommendation({
      term: aggregate.term,
      appName,
      campaignName: campaign.name,
      sourceKeywordText: aggregate.sourceKeywordText,
      impressions: aggregate.impressions,
      taps: aggregate.taps,
      installs: aggregate.installs,
      spend: aggregate.spend,
      fresh: aggregate.latestSync ? Date.now() - Date.parse(aggregate.latestSync) < 48 * 60 * 60 * 1000 : false,
      partialSync: false,
      isControlledExact: exactKeywords.has(normalizedTerm),
      isNegative: exactNegatives.has(normalizedTerm),
    });
    if (!built) continue;
    const { data: snapshot, error: snapshotError } = await db.from("apple_ads_decision_snapshots").insert({
      connection_id: input.connectionId,
      data_window: { source: "apple_ads_search_terms", campaign_id: input.campaignRowId, freshness_hours: 48 },
      metrics: { term: aggregate.term, impressions: aggregate.impressions, taps: aggregate.taps, installs: aggregate.installs, spend: aggregate.spend },
      aso_context: { app_id: campaign.app_id, app_name: appName, campaign_name: campaign.name, source_keyword_text: aggregate.sourceKeywordText },
      model_version: MODEL_VERSION,
      rule_version: RULE_VERSION,
    }).select("id").maybeSingle();
    if (snapshotError) throw new Error(`Could not save Apple Ads decision snapshot: ${snapshotError.message}`);
    const payload = {
      connection_id: input.connectionId,
      app_id: campaign.app_id,
      campaign_id: input.campaignRowId,
      recommendation_type: built.type,
      source: "rules",
      status: "active",
      priority: built.priority,
      confidence: built.confidence,
      financial_risk: built.financialRisk,
      title: built.title,
      evidence_summary: built.evidenceSummary,
      deterministic_rationale: built.deterministicRationale,
      snapshot_id: snapshot?.id ?? null,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: existing, error: lookupError } = await db.from("apple_ads_recommendations").select("id").eq("connection_id", input.connectionId).eq("campaign_id", input.campaignRowId).eq("recommendation_type", built.type).eq("title", built.title).eq("status", "active").limit(1).maybeSingle();
    if (lookupError) throw new Error(`Could not dedupe Apple Ads recommendations: ${lookupError.message}`);
    const result = existing ? await db.from("apple_ads_recommendations").update(payload).eq("id", existing.id) : await db.from("apple_ads_recommendations").insert(payload);
    if (result.error) throw new Error(`Could not save Apple Ads recommendation: ${result.error.message}`);
    generated += 1;
  }
  return { generated };
}
