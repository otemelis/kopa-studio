import { describe, expect, it, vi } from "vitest";
import { loadRankSnapshotPages, type ProgressSnapshot } from "./aso-progress-repository";

const snapshot = (index: number): ProgressSnapshot => ({
  keyword_id: `keyword-${index}`,
  store_app_id: "6785764991",
  captured_at: `2026-10-${String((index % 28) + 1).padStart(2, "0")}T12:00:00Z`,
  captured_on: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
  rank: index + 1,
  found: true,
  result_depth: 100,
  collection_status: "ok",
  source: "itunes_catalog",
});

describe("ASO progress rank pagination", () => {
  it("loads beyond Supabase's 1,000-row response cap in stable pages", async () => {
    const rows = Array.from({ length: 1_872 }, (_, index) => snapshot(index));
    const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));

    const result = await loadRankSnapshotPages(fetchPage);

    expect(result).toHaveLength(1_872);
    expect(fetchPage.mock.calls).toEqual([[0, 999], [1_000, 1_999]]);
  });

  it("propagates a page error rather than silently returning partial history", async () => {
    const fetchPage = vi.fn(async () => ({ data: null, error: { message: "query failed" } }));
    await expect(loadRankSnapshotPages(fetchPage)).rejects.toThrow("query failed");
  });
});
