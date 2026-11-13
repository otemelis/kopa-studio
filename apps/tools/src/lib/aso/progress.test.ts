import { describe, expect, it } from "vitest";
import { bestRecordedRanks, canonicalRankSource, isCollectionRunStalled, observedRank, rankMovement, sourceCaveat, sourceLabel, type RankObservation } from "./progress";

const observation = (day: string, rank: number | null, found = rank != null): RankObservation => ({
  captured_at: `${day}T12:00:00.000Z`, captured_on: day, rank, found, result_depth: 100,
  collection_status: "ok", source: "itunes_catalog",
});

describe("ASO progress semantics", () => {
  it("keeps positive movement as positions gained", () => {
    expect(rankMovement([observation("2026-10-01", 14), observation("2026-10-08", 9)], 7)).toMatchObject({ state: "comparable", positions: 5 });
  });

  it("preserves unranked as a bounded observation, not rank zero", () => {
    expect(observedRank(observation("2026-10-08", null, false))).toBe("Not found in first 100");
    expect(rankMovement([observation("2026-10-01", 14), observation("2026-10-08", null, false)], 7).state).toBe("not_observed");
  });

  it("does not compare distant history or failed observations", () => {
    const rows = [observation("2026-09-01", 20), observation("2026-10-08", 10)];
    expect(rankMovement(rows, 7).state).toBe("insufficient");
    expect(rankMovement([{ ...observation("2026-10-08", 10), collection_status: "failed" }], 1).state).toBe("insufficient");
  });

  it("keeps the ranking source names and caveats distinct", () => {
    expect(sourceLabel("public_store")).toBe("iTunes Search catalog");
    expect(canonicalRankSource("public_store")).toBe("itunes_catalog");
    expect(canonicalRankSource("apple_web_search")).toBe("apple_web_search");
    expect(sourceCaveat("itunes_catalog")).toContain("not native organic rank");
    expect(sourceCaveat("apple_web_search")).toContain("may be uncertain");
  });

  it("calculates a recorded best separately for each keyword and source", () => {
    expect(bestRecordedRanks([
      { keyword_id: "one", source: "apple_web_search", rank: 8 },
      { keyword_id: "one", source: "apple_web_search", rank: 3 },
      { keyword_id: "one", source: "itunes_catalog", rank: 1 },
      { keyword_id: "two", source: "apple_web_search", rank: 5 },
      { keyword_id: "one", source: "apple_web_search", rank: 0 },
    ])).toEqual({ "apple_web_search:one": 3, "itunes_catalog:one": 1, "apple_web_search:two": 5 });
  });

  it("marks a collector run stalled only after its six-minute lease", () => {
    const now = Date.parse("2026-10-18T18:00:00Z");
    expect(isCollectionRunStalled("running", "2026-10-18T17:54:01Z", now)).toBe(false);
    expect(isCollectionRunStalled("running", "2026-10-18T17:54:01Z", now + 2_000)).toBe(true);
    expect(isCollectionRunStalled("failed", "2026-10-18T17:00:00Z", now)).toBe(false);
  });
});
