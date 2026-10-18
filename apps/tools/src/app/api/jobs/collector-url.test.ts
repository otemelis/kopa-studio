import { describe, expect, it } from "vitest";
import { rankingCollectorUrl } from "./collector-url";

describe("manual ranking collector target", () => {
  it("pins the default collector path to the bounded rankings endpoint", () => {
    expect(rankingCollectorUrl().toString()).toBe("https://www.kopa.studio/api/aso/collect-rankings");
  });

  it("replaces a full-scope query when converting the standard collector URL", () => {
    expect(rankingCollectorUrl("https://collector.example/api/aso/collect?scope=full&slot=2").toString())
      .toBe("https://collector.example/api/aso/collect-rankings?slot=2");
  });

  it("adds the rankings scope for a custom collector endpoint", () => {
    expect(rankingCollectorUrl("https://collector.example/worker?token=hidden").toString())
      .toBe("https://collector.example/worker?token=hidden&scope=rankings");
  });
});
