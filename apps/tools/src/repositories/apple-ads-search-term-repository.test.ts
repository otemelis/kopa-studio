import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAppleAdsSearchTerms } from "./apple-ads-search-term-repository";

const tables = new Map<string, unknown[]>();
const queryResult = (table: string) => Promise.resolve({ data: tables.get(table) ?? [], error: null });

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => queryResult(table),
        in: () => {
          const result = {
            order: () => ({
              limit: () => queryResult(table),
            }),
            then: (resolve: (value: { data: unknown[]; error: null }) => void) => queryResult(table).then(resolve),
          };
          return result;
        },
      }),
    }),
  }),
}));

describe("listAppleAdsSearchTerms", () => {
  beforeEach(() => {
    tables.clear();
  });

  it("reads search terms for the owner connection and resolves names", async () => {
    tables.set("apple_ads_connections", [{ id: "conn-1" }]);
    tables.set("apple_ads_search_terms", [{
      id: "term-1",
      campaign_id: "camp-1",
      ad_group_id: "group-1",
      keyword_id: "keyword-1",
      search_term: "personality test",
      source_keyword_text: null,
      match_source: "SEARCH_MATCH",
      country: "gb",
      metric_date: "2026-07-21",
      impressions: 100,
      taps: 8,
      installs: 2,
      spend: 3.5,
      currency: "GBP",
      intent_cluster: "generic",
      product_fit: "good",
      suggested_action: "Add exact",
    }]);
    tables.set("apple_ads_campaigns", [{ id: "camp-1", name: "UK Discovery" }]);
    tables.set("apple_ads_ad_groups", [{ id: "group-1", name: "Search Match" }]);
    tables.set("apple_ads_keywords", [{ id: "keyword-1", keyword_text: "personality type test" }]);

    await expect(listAppleAdsSearchTerms("user-1")).resolves.toEqual([expect.objectContaining({
      searchTerm: "personality test",
      campaignName: "UK Discovery",
      adGroupName: "Search Match",
      sourceKeywordText: "personality type test",
      impressions: 100,
      spend: 3.5,
    })]);
  });
});
