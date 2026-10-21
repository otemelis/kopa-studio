import { describe, expect, it } from "vitest";
import { matchesRecommendationScope, normalizeRecommendationMarket } from "./recommendation-scope";

const appId = "app-innertype";
const fixture = [
  { id: "aso-portfolio", appId, market: null },
  { id: "ads-gb", appId, market: "GB" },
  { id: "ads-de", appId, market: "DE" },
  { id: "discovery-gb", appId, market: "gb" },
  { id: "other-app-gb", appId: "app-other", market: "gb" },
];

describe("recommendation scope", () => {
  it("keeps only the selected app and exact GB market", () => {
    expect(fixture.filter((item) => matchesRecommendationScope(item, { appId, country: "gb" })).map((item) => item.id))
      .toEqual(["ads-gb", "discovery-gb"]);
  });

  it("does not surface portfolio findings inside an exact market", () => {
    expect(matchesRecommendationScope(fixture[0], { appId, country: "gb" })).toBe(false);
  });

  it("allows portfolio and market findings when no market is selected", () => {
    expect(fixture.filter((item) => matchesRecommendationScope(item, { appId })).map((item) => item.id))
      .toEqual(["aso-portfolio", "ads-gb", "ads-de", "discovery-gb"]);
  });

  it("normalizes storefront case and the all-market sentinel", () => {
    expect(normalizeRecommendationMarket(" GB ")).toBe("gb");
    expect(normalizeRecommendationMarket("all")).toBeNull();
  });
});
