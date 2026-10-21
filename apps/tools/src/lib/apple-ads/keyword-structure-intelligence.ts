import type { AppleAdsStructure, AppleAdsStructureAdGroup, AppleAdsStructureKeyword } from "@/repositories/apple-ads-structure-repository";
import { formatAppleAdsDeliveryStatus, formatAppleAdsEntityStatus } from "./status";

export type KeywordIntentLabel = "branded" | "generic" | "competitor_or_unknown";
export type KeywordSetupFinding = {
  id: string;
  severity: "info" | "warning" | "attention";
  title: string;
  detail: string;
  evidence: string;
};
export type KeywordIntelligenceRow = {
  id: string;
  keywordText: string;
  normalizedKeyword: string;
  campaignName: string;
  adGroupName: string;
  matchType: string;
  status: string;
  intentLabel: KeywordIntentLabel;
  duplicateCount: number;
  hasNegativeMatch: boolean;
  bidAmount: number | null;
  currency: string | null;
};
export type AdGroupCoverage = {
  id: string;
  campaignName: string;
  adGroupName: string;
  keywordCount: number;
  negativeKeywordCount: number;
  searchMatchEnabled: boolean | null;
  hasExact: boolean;
  hasBroad: boolean;
};
export type KeywordStructureIntelligence = {
  summary: { keywords: number; duplicates: number; adGroupsWithoutNegatives: number; broadOnlyAdGroups: number; pausedKeywords: number };
  findings: KeywordSetupFinding[];
  adGroups: AdGroupCoverage[];
  keywords: KeywordIntelligenceRow[];
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const match = (value: string | null) => (value ?? "unknown").toUpperCase();
const isPaused = (value: string | null | undefined) => /paused|deleted|disabled/i.test(value ?? "");
const isActive = (value: string | null | undefined) => /^(active|running|enabled)$/i.test((value ?? "").trim());
const tokens = (value: string) => normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
const marketScope = (campaign: { countriesOrRegions: string[] } | undefined) => campaign?.countriesOrRegions.map((country) => country.toUpperCase()).sort().join(",") || "UNKNOWN";

function intentLabel(keyword: AppleAdsStructureKeyword, adGroup: AppleAdsStructureAdGroup | undefined, campaignName: string): KeywordIntentLabel {
  const text = normalize(keyword.keywordText);
  const contextTokens = new Set([...tokens(adGroup?.name ?? ""), ...tokens(campaignName)]);
  if ([...contextTokens].some((token) => text.includes(token))) return "branded";
  if (text.split(" ").length >= 2) return "generic";
  return "competitor_or_unknown";
}

export function analyzeAppleAdsKeywordStructure(structure: AppleAdsStructure): KeywordStructureIntelligence {
  const campaignNames = new Map(structure.campaigns.map((campaign) => [campaign.id, campaign.name]));
  const campaigns = new Map(structure.campaigns.map((campaign) => [campaign.id, campaign]));
  const adGroups = new Map(structure.adGroups.map((adGroup) => [adGroup.id, adGroup]));
  const keywordGroups = new Map<string, AppleAdsStructureKeyword[]>();
  for (const keyword of structure.keywords) {
    const key = [keyword.campaignId, keyword.adGroupId, marketScope(campaigns.get(keyword.campaignId)), normalize(keyword.keywordText), match(keyword.matchType)].join("|");
    keywordGroups.set(key, [...(keywordGroups.get(key) ?? []), keyword]);
  }
  const negatives = new Set(structure.negativeKeywords.map((keyword) => normalize(keyword.keywordText)));

  const keywordRows = structure.keywords.map((keyword) => {
    const adGroup = adGroups.get(keyword.adGroupId);
    const normalizedKeyword = normalize(keyword.keywordText);
    const duplicateKey = [keyword.campaignId, keyword.adGroupId, marketScope(campaigns.get(keyword.campaignId)), normalizedKeyword, match(keyword.matchType)].join("|");
    return {
      id: keyword.id,
      keywordText: keyword.keywordText,
      normalizedKeyword,
      campaignName: campaignNames.get(keyword.campaignId) ?? "Campaign",
      adGroupName: adGroup?.name ?? "Ad group",
      matchType: match(keyword.matchType),
      status: keyword.status ?? "unknown",
      intentLabel: intentLabel(keyword, adGroup, campaignNames.get(keyword.campaignId) ?? ""),
      duplicateCount: keywordGroups.get(duplicateKey)?.length ?? 1,
      hasNegativeMatch: negatives.has(normalizedKeyword),
      bidAmount: keyword.bidAmount,
      currency: keyword.currency,
    };
  });

  const coverage = structure.adGroups.map((adGroup) => {
    const keywords = structure.keywords.filter((keyword) => keyword.adGroupId === adGroup.id);
    return {
      id: adGroup.id,
      campaignName: campaignNames.get(adGroup.campaignId) ?? "Campaign",
      adGroupName: adGroup.name,
      keywordCount: keywords.length,
      negativeKeywordCount: adGroup.negativeKeywordCount,
      searchMatchEnabled: adGroup.searchMatchEnabled,
      hasExact: keywords.some((keyword) => match(keyword.matchType).includes("EXACT")),
      hasBroad: keywords.some((keyword) => match(keyword.matchType).includes("BROAD")),
    };
  });

  const duplicateKeywords = [...keywordGroups.entries()].filter(([, rows]) => rows.length > 1);
  const adGroupsWithoutProtectiveNegatives = coverage.filter((adGroup) => adGroup.negativeKeywordCount === 0 && (adGroup.searchMatchEnabled === true || adGroup.hasBroad));
  const broadOnlyAdGroups = coverage.filter((adGroup) => adGroup.hasBroad && !adGroup.hasExact);
  const exactOnlyAdGroups = coverage.filter((adGroup) => adGroup.hasExact && !adGroup.hasBroad);
  const pausedKeywords = keywordRows.filter((keyword) => isPaused(keyword.status));
  const inactiveCampaigns = structure.campaigns.filter((campaign) => !isActive(campaign.status) && !isActive(campaign.servingStatus));

  const findings: KeywordSetupFinding[] = [];
  if (!structure.keywords.length) findings.push({ id: "no-keywords", severity: "attention", title: "No keywords imported", detail: "Structure sync has not imported any target keywords yet.", evidence: "Keyword count is 0." });
  if (duplicateKeywords.length) findings.push({ id: "duplicates", severity: "warning", title: "Duplicate keyword coverage", detail: "Some keyword text appears more than once inside the same campaign, market, ad group, and match type. Cross-market structure is treated as intentional.", evidence: duplicateKeywords.map(([, rows]) => `${normalize(rows[0].keywordText)} x${rows.length}`).join(", ") });
  if (adGroupsWithoutProtectiveNegatives.length) findings.push({ id: "missing-negatives", severity: "warning", title: "Missing protective negatives", detail: "Discovery or Search Match ad groups have no imported protective negatives. Exact-only ad groups are not flagged.", evidence: adGroupsWithoutProtectiveNegatives.map((adGroup) => adGroup.adGroupName).join(", ") });
  if (broadOnlyAdGroups.length) findings.push({ id: "broad-only", severity: "attention", title: "Broad-only ad group coverage", detail: "At least one ad group has broad keywords without exact counterparts. Exact controls can be prepared once search-term evidence appears.", evidence: broadOnlyAdGroups.map((adGroup) => adGroup.adGroupName).join(", ") });
  if (exactOnlyAdGroups.length) findings.push({ id: "exact-only", severity: "info", title: "Exact-only ad group coverage", detail: "At least one ad group has exact keywords without broad discovery terms. This is controlled, but it may limit discovery.", evidence: exactOnlyAdGroups.map((adGroup) => adGroup.adGroupName).join(", ") });
  if (pausedKeywords.length) findings.push({ id: "paused-keywords", severity: "info", title: "Paused keyword rows", detail: "Paused imported keywords will not produce delivery until reactivated in Apple Ads.", evidence: `${pausedKeywords.length} paused keyword row${pausedKeywords.length === 1 ? "" : "s"}.` });
  if (inactiveCampaigns.length) findings.push({ id: "inactive-campaigns", severity: "info", title: "Campaign not actively serving", detail: "The imported campaign status suggests delivery is paused or not serving, which explains missing performance rows.", evidence: inactiveCampaigns.map((campaign) => `${campaign.name}: ${formatAppleAdsEntityStatus(campaign.status).label}, ${formatAppleAdsDeliveryStatus(campaign.servingStatus).label}`).join(", ") });
  if (!findings.length) findings.push({ id: "structure-ready", severity: "info", title: "Structure is ready for delivery evidence", detail: "No pre-delivery setup issues were detected from imported campaign structure.", evidence: `${structure.keywords.length} keywords across ${structure.adGroups.length} ad groups.` });

  return {
    summary: {
      keywords: keywordRows.length,
      duplicates: duplicateKeywords.reduce((total, [, rows]) => total + rows.length, 0),
      adGroupsWithoutNegatives: adGroupsWithoutProtectiveNegatives.length,
      broadOnlyAdGroups: broadOnlyAdGroups.length,
      pausedKeywords: pausedKeywords.length,
    },
    findings,
    adGroups: coverage,
    keywords: keywordRows,
  };
}
