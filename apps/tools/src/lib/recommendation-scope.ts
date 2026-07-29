export type RecommendationScope = {
  appId?: string | null;
  country?: string | null;
};

export type ScopedRecommendation = {
  appId: string | null;
  market: string | null;
};

export const normalizeRecommendationMarket = (value: string | null | undefined) => {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized && normalized !== "all" ? normalized : null;
};

export function matchesRecommendationScope(item: ScopedRecommendation, scope: RecommendationScope) {
  if (scope.appId && item.appId !== scope.appId) return false;
  const country = normalizeRecommendationMarket(scope.country);
  if (country && normalizeRecommendationMarket(item.market) !== country) return false;
  return true;
}
