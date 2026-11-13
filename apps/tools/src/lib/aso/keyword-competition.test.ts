import { describe, expect, it } from "vitest";
import { observedPositions, positionInSnapshot, positionSummary } from "./keyword-competition";
import type { SearchSnapshot } from "@/repositories/keyword-competition-repository";

const snapshot = (day: string, source: string, results: SearchSnapshot["results"], depth = 12): SearchSnapshot => ({
  captured_at: `${day}T12:00:00Z`, captured_on: day, source, result_depth: depth, results,
});

describe("keyword competition observations", () => {
  it("matches exact app IDs, excludes ads, and keeps catalog order separate from web order", () => {
    const web = snapshot("2026-11-10", "apple_web_search", [
      { store_app_id: "123", organic_position: 1, explicit_ad: true },
      { store_app_id: "456", organic_position: 2, classification: "unclassified" },
    ]);
    expect(positionInSnapshot(web, "123")).toBeNull();
    expect(positionInSnapshot(web, "456")).toBe(2);
    expect(positionInSnapshot(snapshot("2026-11-10", "itunes_catalog", [{ store_app_id: "456", catalog_position: 7, organic_position: 2 }]), "456")).toBe(7);
    expect(positionInSnapshot(web, "45")).toBeNull();
  });

  it("uses the latest daily snapshot and never turns absence into a zero rank", () => {
    const rows = [snapshot("2026-11-10", "apple_web_search", [{ store_app_id: "456", organic_position: 8 }]),
      snapshot("2026-11-11", "apple_web_search", [], 11),
      snapshot("2026-11-11", "itunes_catalog", [{ store_app_id: "456", catalog_position: 1 }])];
    const points = observedPositions(rows, "apple_web_search", "456");
    expect(points.map((point) => point.rank)).toEqual([8, null]);
    expect(positionSummary(points)).toMatchObject({ best: 8, change: null, latest: { depth: 11, rank: null } });
  });

  it("reports positive movement only when the position number improves across days", () => {
    const points = observedPositions([
      snapshot("2026-11-10", "apple_web_search", [{ store_app_id: "456", organic_position: 12 }]),
      snapshot("2026-11-12", "apple_web_search", [{ store_app_id: "456", organic_position: 4 }]),
    ], "apple_web_search", "456");
    expect(positionSummary(points)).toMatchObject({ best: 4, change: 8 });
  });
});
