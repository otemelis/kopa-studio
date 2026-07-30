import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  tables: new Map<string, Array<Record<string, unknown>>>(),
  filters: [] as Array<{ table: string; operation: string; column: string; value: unknown }>,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const filters: Array<{ operation: string; column: string; value: unknown }> = [];
      const builder = {
        select: () => builder,
        gte: (column: string, value: unknown) => {
          filters.push({ operation: "gte", column, value });
          state.filters.push({ table, operation: "gte", column, value });
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters.push({ operation: "eq", column, value });
          state.filters.push({ table, operation: "eq", column, value });
          return builder;
        },
        in: (column: string, value: unknown[]) => {
          filters.push({ operation: "in", column, value });
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        then: (
          resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => {
          const rows = (state.tables.get(table) ?? []).filter((row) => filters.every((filter) => {
            if (filter.operation === "gte") return String(row[filter.column] ?? "") >= String(filter.value);
            if (filter.operation === "eq") return row[filter.column] === filter.value;
            if (filter.operation === "in") return (filter.value as unknown[]).includes(row[filter.column]);
            return true;
          }));
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  }),
}));

import { listStorefrontMetricSummaries } from "./storefront-metrics-repository";

const NOW = new Date("2026-07-31T12:00:00.000Z");

describe("listStorefrontMetricSummaries period and scope", () => {
  beforeEach(() => {
    state.tables.clear();
    state.filters.length = 0;
    state.tables.set("aso_apps", [
      { id: "app-a", name: "InnerType" },
      { id: "app-b", name: "Other app" },
    ]);
    state.tables.set("aso_storefront_metrics", [
      { app_id: "app-a", country: "gb", date: "2026-07-30", event: "Impression", page_type: null, source_type: "App Store Search", count: 10 },
      { app_id: "app-a", country: "gb", date: "2026-06-01", event: "Impression", page_type: null, source_type: "App Store Search", count: 20 },
      { app_id: "app-b", country: "gb", date: "2026-07-30", event: "Impression", page_type: null, source_type: "App Store Search", count: 99 },
      { app_id: "app-a", country: "de", date: "2026-07-30", event: "Impression", page_type: null, source_type: "App Store Search", count: 88 },
    ]);
    state.tables.set("aso_daily_metrics", []);
    state.tables.set("aso_analytics_report_requests", [{
      app_id: "app-a",
      last_result_state: "success",
      parser_version: "discovery-v2",
      last_evidence_start: "2026-07-24",
      last_evidence_end: "2026-07-30",
      last_source_row_count: 2,
      last_imported_row_count: 2,
      last_rejected_row_count: 0,
      last_error: null,
    }]);
  });

  it("keeps 7-day and 90-day evidence isolated", async () => {
    const sevenDays = await listStorefrontMetricSummaries(7, "app-a", "GB", NOW);
    const ninetyDays = await listStorefrontMetricSummaries(90, "app-a", "GB", NOW);

    expect(sevenDays.totals.impressions).toBe(10);
    expect(sevenDays.evidenceWindow).toEqual({ start: "2026-07-30", end: "2026-07-30" });
    expect(ninetyDays.totals.impressions).toBe(30);
    expect(ninetyDays.evidenceWindow).toEqual({ start: "2026-06-01", end: "2026-07-30" });
  });

  it("applies the selected app and exact normalized market to both evidence queries", async () => {
    const result = await listStorefrontMetricSummaries(28, "app-a", "GB", NOW);

    expect(result.countries).toEqual([expect.objectContaining({ appId: "app-a", country: "gb", impressions: 10 })]);
    expect(result.quality).toMatchObject({ state: "fresh", label: "Fresh" });
    for (const table of ["aso_storefront_metrics", "aso_daily_metrics"]) {
      expect(state.filters).toContainEqual({ table, operation: "gte", column: "date", value: "2026-07-04" });
      expect(state.filters).toContainEqual({ table, operation: "eq", column: "app_id", value: "app-a" });
      expect(state.filters).toContainEqual({ table, operation: "eq", column: "country", value: "gb" });
    }
    expect(state.filters).toContainEqual({ table: "aso_analytics_report_requests", operation: "eq", column: "app_id", value: "app-a" });
    expect(state.filters).not.toContainEqual(expect.objectContaining({ table: "aso_analytics_report_requests", column: "country" }));
  });

  it("does not treat a successful app report as scoped evidence for a market with no rows", async () => {
    const result = await listStorefrontMetricSummaries(28, "app-a", "fr", NOW);
    expect(result.quality).toMatchObject({ state: "absent", label: "Absent" });
    expect(result.opportunities).toEqual([
      expect.objectContaining({ severity: "waiting", title: "Waiting for scoped Discovery evidence" }),
    ]);
  });
});
