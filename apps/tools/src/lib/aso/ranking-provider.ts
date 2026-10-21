/**
 * Provider-neutral boundary for verified App Store keyword rank observations.
 * Vendor estimates and normalized plotting values deliberately do not enter
 * this contract.
 */

export type RankingQuery = {
  appStoreId: string;
  keyword: string;
  country: string;
  /** Storefront search language; null means the provider cannot specify it. */
  language: string | null;
  device: "iphone" | "ipad";
};

export type RankingProviderName = "appfigures" | "apptweak" | "appfollow" | (string & {});

export type RankingObservationBase = {
  appStoreId: string;
  keyword: string;
  country: string;
  requestedLanguage: string | null;
  /** Null unless the provider explicitly reports the effective storefront language. */
  effectiveLanguage: string | null;
  languageEvidence: "explicit" | "provider_default" | "unknown";
  device: "iphone" | "ipad";
  /** Date/time represented by the source observation, not the ingestion time. */
  observedAt: string;
  /** When Kopa received and validated the response. */
  retrievedAt: string;
  provider: RankingProviderName;
  providerObservationId: string | null;
  granularity: "current" | "daily" | "hourly";
  resultDepth: number | null;
};

export type RankingObservation =
  | (RankingObservationBase & {
      state: "ranked";
      position: number;
      evidence: "provider_checked";
    })
  | (RankingObservationBase & {
      state: "unranked";
      position: null;
      evidence: "provider_checked";
    })
  | (RankingObservationBase & {
      state: "unavailable";
      position: null;
      evidence: "not_checked" | "provider_error" | "provider_ambiguous";
      reason: string;
    });

export type ProviderRankResult =
  | { checked: true; position: number }
  | { checked: true; position: null }
  | { checked: false; position: null; reason: string };

export interface RankingProvider {
  readonly name: RankingProviderName;
  fetchCurrent(query: RankingQuery): Promise<ProviderRankResult>;
  fetchHistory(query: RankingQuery, startDate: string, endDate: string): Promise<ProviderRankResult[]>;
}

/**
 * Normalize only explicit provider evidence. Missing/filled/sentinel values
 * are never converted to organic ranks or unranked observations.
 */
export function normalizeRankingObservation(
  query: RankingQuery,
  provider: RankingProviderName,
  result: ProviderRankResult,
  metadata: Pick<RankingObservationBase, "observedAt" | "retrievedAt" | "providerObservationId" | "granularity" | "resultDepth" | "effectiveLanguage" | "languageEvidence">,
): RankingObservation {
  const base: RankingObservationBase = {
    ...query,
    requestedLanguage: query.language,
    effectiveLanguage: metadata.effectiveLanguage,
    languageEvidence: metadata.languageEvidence,
    observedAt: metadata.observedAt,
    retrievedAt: metadata.retrievedAt,
    provider,
    providerObservationId: metadata.providerObservationId,
    granularity: metadata.granularity,
    resultDepth: metadata.resultDepth,
  };

  if (!result.checked) {
    return {
      ...base,
      state: "unavailable",
      position: null,
      evidence: "not_checked",
      reason: result.reason,
    };
  }
  if (result.position === null) {
    return { ...base, state: "unranked", position: null, evidence: "provider_checked" };
  }
  if (!Number.isInteger(result.position) || result.position < 1) {
    return {
      ...base,
      state: "unavailable",
      position: null,
      evidence: "provider_ambiguous",
      reason: "Provider returned a non-positive or non-integer position.",
    };
  }
  return { ...base, state: "ranked", position: result.position, evidence: "provider_checked" };
}
