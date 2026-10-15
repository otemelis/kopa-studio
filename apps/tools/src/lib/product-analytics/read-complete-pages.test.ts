import { describe, expect, it } from "vitest";
import { readCompletePages } from "./read-complete-pages";
describe("complete source reads under server row caps", () => {
  it("reads all 4694 rows when a request is capped at 1000", async () => {
    const rows = Array.from({ length: 4694 }, (_, id) => ({ id }));
    let calls = 0;
    const result = await readCompletePages(
      async (offset, last: { id: number } | undefined) => {
        calls++;
        if (offset) expect(last?.id).toBe(offset - 1);
        return {
          data: rows.slice(offset, offset + 1000),
          count: rows.length - offset,
          error: null,
        };
      },
    );
    expect(result).toHaveLength(4694);
    expect(calls).toBe(5);
  });
  it("does not treat a short capped page as completion", async () => {
    const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
    expect(
      await readCompletePages(async (offset) => ({
        data: rows.slice(offset, offset + 500),
        count: rows.length - offset,
        error: null,
      })),
    ).toHaveLength(1201);
  });
  it("rejects failed, incomplete, uncounted and oversized reads instead of returning partial metrics", async () => {
    await expect(
      readCompletePages(async (offset) => ({
        data: offset ? null : [1],
        count: 2,
        error: offset ? new Error("offline") : null,
      })),
    ).rejects.toThrow();
    await expect(
      readCompletePages(async (offset) => ({
        data: offset ? [] : [1],
        count: 2,
        error: null,
      })),
    ).rejects.toThrow("Source ended");
    await expect(
      readCompletePages(async () => ({ data: [1], count: null, error: null })),
    ).rejects.toThrow("completeness");
    await expect(
      readCompletePages(async () => ({ data: [], count: 50001, error: null })),
    ).rejects.toThrow("exceeds");
  });
});
