import { describe, expect, it } from "vitest";
import { recommendationIdentity } from "./recommendation-identity";

const scoped = {
  appId: "9bf77c42-ff52-4030-b759-ef56557adca3",
  market: "GB",
};

describe("cross-source recommendation identity", () => {
  it("normalizes equivalent scope and target text", () => {
    expect(recommendationIdentity({
      source: "discovery",
      ...scoped,
      kind: "Strongest_Source",
      targetText: "  App Store   Search ",
    })).toBe(recommendationIdentity({
      source: "discovery",
      appId: scoped.appId.toUpperCase(),
      market: "gb",
      kind: "strongest_source",
      targetText: "app store search",
    }));
  });

  it("does not depend on provider row IDs, evidence windows, timestamps, or list position", () => {
    const input = {
      source: "discovery" as const,
      ...scoped,
      kind: "weak_page_view_pull",
    };
    expect(recommendationIdentity(input)).toBe(recommendationIdentity({ ...input }));
  });

  it("isolates source, app, market, conclusion kind, and target", () => {
    const base = {
      source: "apple_ads" as const,
      ...scoped,
      kind: "ADD_NEGATIVE_EXACT",
      targetType: "SEARCH_TERM",
      targetText: "lovense",
    };
    const identity = recommendationIdentity(base);
    expect(recommendationIdentity({ ...base, source: "aso" })).not.toBe(identity);
    expect(recommendationIdentity({ ...base, appId: "other-app" })).not.toBe(identity);
    expect(recommendationIdentity({ ...base, market: "US" })).not.toBe(identity);
    expect(recommendationIdentity({ ...base, kind: "REVIEW_BROAD_KEYWORD" })).not.toBe(identity);
    expect(recommendationIdentity({ ...base, targetText: "lovense remote" })).not.toBe(identity);
  });

  it("gives reordered Discovery conclusions the same identities", () => {
    const conclusions = [
      { kind: "weak_page_view_pull", targetText: null },
      { kind: "strongest_source", targetText: "App Store Search" },
      { kind: "page_views_rising", targetText: null },
    ];
    const identities = (items: typeof conclusions) => items.map((item) => recommendationIdentity({
      source: "discovery",
      ...scoped,
      ...item,
    })).sort();
    expect(identities(conclusions)).toEqual(identities([...conclusions].reverse()));
  });
});
