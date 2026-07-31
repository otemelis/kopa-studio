import { createHash } from "node:crypto";

export const RECOMMENDATION_IDENTITY_VERSION = "recommendation-identity-v1";

export type RecommendationIdentitySource = "aso" | "discovery" | "apple_ads";

export type RecommendationIdentityInput = {
  source: RecommendationIdentitySource;
  scopeId?: string | null;
  appId?: string | null;
  market?: string | null;
  locale?: string | null;
  kind: string;
  targetType?: string | null;
  targetId?: string | null;
  targetText?: string | null;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || null;
}

export function recommendationIdentity(input: RecommendationIdentityInput) {
  const canonical = {
    version: RECOMMENDATION_IDENTITY_VERSION,
    source: input.source,
    scopeId: normalize(input.scopeId),
    appId: normalize(input.appId),
    market: normalize(input.market),
    locale: normalize(input.locale),
    kind: normalize(input.kind),
    targetType: normalize(input.targetType),
    targetId: normalize(input.targetId),
    targetText: normalize(input.targetText),
  };
  const digest = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return `${RECOMMENDATION_IDENTITY_VERSION}:${digest}`;
}
