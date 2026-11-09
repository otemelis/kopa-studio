import { describe, expect, it } from "vitest";
import { MAX_POPULARITY_GROUPS_PER_RUN, planApplePopularityRefresh } from "./apple-popularity-schedule";

describe("weekly Apple demand catch-up", () => {
  it("treats observed and not-reported rows as complete, but retries a partially covered market", () => {
    const apps = [{ id: "passport", category: "Travel" }];
    const links = [
      { app_id: "passport", keyword_id: "us-one" },
      { app_id: "passport", keyword_id: "us-two" },
      { app_id: "passport", keyword_id: "de-one" },
    ];
    const keywords = [
      { id: "us-one", country: "us" },
      { id: "us-two", country: "us" },
      { id: "de-one", country: "de" },
    ];
    const plan = planApplePopularityRefresh(apps, links, keywords, [
      { keyword_id: "us-one", genre: "TRAVEL" },
      { keyword_id: "de-one", genre: "TRAVEL" },
    ]);
    expect(plan).toMatchObject({ totalGroups: 2, pendingGroups: 1, selected: [{ appId: "passport", country: "US", genre: "TRAVEL" }] });
    expect(planApplePopularityRefresh(apps, links, keywords, [
      { keyword_id: "us-one", genre: "TRAVEL" },
      { keyword_id: "us-two", genre: "TRAVEL" },
      { keyword_id: "de-one", genre: "TRAVEL" },
    ]).pendingGroups).toBe(0);
  });

  it("does not accept observations for a different Apple genre", () => {
    const plan = planApplePopularityRefresh([{ id: "pois", category: "Health & Fitness" }],
      [{ app_id: "pois", keyword_id: "term" }], [{ id: "term", country: "us" }],
      [{ keyword_id: "term", genre: "TRAVEL" }]);
    expect(plan.pendingGroups).toBe(1);
  });

  it("bounds each invocation while leaving other groups for later runs", () => {
    const apps = [{ id: "passport", category: "Travel" }];
    const links = Array.from({ length: 25 }, (_, i) => ({ app_id: "passport", keyword_id: `term-${i}` }));
    const keywords = links.map(({ keyword_id }, i) => ({ id: keyword_id, country: `c${i}` }));
    const plan = planApplePopularityRefresh(apps, links, keywords, []);
    expect(plan.pendingGroups).toBe(25);
    expect(plan.selected).toHaveLength(MAX_POPULARITY_GROUPS_PER_RUN);
  });

  it("fails closed on unresolved active assignments", () => {
    expect(() => planApplePopularityRefresh([], [{ app_id: "missing", keyword_id: "missing" }], [], [])).toThrow("unresolved");
  });
});
