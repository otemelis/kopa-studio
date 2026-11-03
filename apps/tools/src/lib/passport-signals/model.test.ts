import { describe, expect, it } from "vitest";
import { parseVercelCount, parseVercelRows, summarizePassportCounts, type PassportCount } from "./model";

const row = (event: string, count: number, channel: PassportCount["buildChannel"] = "appstore", appVersion = "1.0"): PassportCount => ({
  day: "2026-10-29", buildChannel: channel, appVersion, event, count, dims: "layout=standard", updatedAt: "2026-10-30T12:00:00.000Z",
});

describe("PASSPORT aggregate reporting", () => {
  it("keeps event counts, device-local days and versions separate", () => {
    const summary = summarizePassportCounts([
      row("app_opened", 5), row("app_opened", 2), row("stamp_created", 10),
      row("first_stamp_completed", 1), row("flight_logged", 2, "testflight", "1.2"),
    ]);
    expect(summary.total("app_opened")).toBe(7);
    expect(summary.total("first_stamp_completed")).toBe(1);
    expect(summary.byVersion).toEqual([
      { version: "1.2", events: 2, opens: 0, firstStamps: 0 },
      { version: "1.0", events: 18, opens: 7, firstStamps: 1 },
    ]);
    expect(summary.byDay).toEqual([{ day: "2026-10-29", opens: 7, firstStamps: 1, allEvents: 20 }]);
  });

  it("accepts Vercel's documented count and day aggregate shapes", () => {
    expect(parseVercelCount({ data: { visitors: 22, pageviews: 31 } })).toEqual({ visitors: 22, pageviews: 31 });
    expect(parseVercelRows({ data: [{ timestamp: "2026-11-02T00:00:00.000Z", visitors: 1, pageviews: 2 }] }, "day"))
      .toEqual([{ label: "2026-11-02", visitors: 1, pageviews: 2 }]);
    expect(parseVercelRows({ data: [{ referrerHostname: "", visitors: 2, pageviews: 3 }] }, "referrerHostname"))
      .toEqual([{ label: "(direct / unknown)", visitors: 2, pageviews: 3 }]);
  });

  it("rejects incomplete or malformed provider responses instead of showing zero", () => {
    expect(() => parseVercelCount({ data: {} })).toThrow();
    expect(() => parseVercelRows({ data: [{ timestamp: "2026-11-02", visitors: "1", pageviews: 2 }] }, "day")).toThrow();
  });
});
