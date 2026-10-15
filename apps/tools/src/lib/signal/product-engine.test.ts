import { describe, it, expect } from "vitest";
import {
  normalizeEvents,
  orderedFunnel,
  pathTransitions,
  retention,
  scopedEvents,
} from "./product-engine";
import {
  parseScope,
  scopeParams,
  fixturePreviewAllowed,
  windowFor,
  priorWindow,
  type EventFact,
} from "./contracts";
import { rankSummary, cpa, rankScale, toCSV } from "./analytics";
import {
  buildSampleSnapshot,
  snapshotExport,
  coverageForArea,
} from "./snapshot";
import { resolveTheme } from "./theme";
const e = (
  id: string,
  name: string,
  at: string,
  installId: string | null = "a",
  sessionId: string | null = "s",
  app: "pois" | "innertype" = "pois",
): EventFact => ({
  id,
  name,
  at,
  installId,
  sessionId,
  app,
  country: "DE",
  environment: "prod",
  version: "1",
  schemaVersion: 1,
  properties: {},
});
const scope = () => parseScope(new URLSearchParams());
describe("ordered identity-aware product analytics", () => {
  it("repeated event counts cannot masquerade as conversions", () => {
    const rows = [
      e("1", "start", "2026-10-01T10:00Z"),
      e("2", "start", "2026-10-01T10:01Z"),
      e("3", "finish", "2026-10-01T10:02Z"),
    ];
    expect(
      orderedFunnel(rows, ["start", "finish"], "install", 24).map(
        (r) => r.count,
      ),
    ).toEqual([1, 1]);
  });
  it("out-of-order steps do not convert", () => {
    const rows = [
      e("1", "finish", "2026-10-01T09:00Z"),
      e("2", "start", "2026-10-01T10:00Z"),
    ];
    expect(
      orderedFunnel(rows, ["start", "finish"], "install", 24).map(
        (r) => r.count,
      ),
    ).toEqual([1, 0]);
  });
  it("a conversion outside the window does not count", () => {
    expect(
      orderedFunnel(
        [e("1", "a", "2026-10-01T10:00Z"), e("2", "b", "2026-10-02T10:01Z")],
        ["a", "b"],
        "install",
        24,
      )[1].count,
    ).toBe(0);
  });
  it("right-censored entrants are excluded, even if they happened to finish quickly", () => {
    expect(
      orderedFunnel(
        [e("1", "a", "2026-10-01T10:00Z"), e("2", "b", "2026-10-01T10:01Z")],
        ["a", "b"],
        "install",
        24,
        "2026-10-01T23:59Z",
      )[0].count,
    ).toBe(0);
  });
  it("session and install identities have deliberately different meaning", () => {
    const rows = [
      e("1", "a", "2026-10-01T10:00Z", "a", "s1"),
      e("2", "b", "2026-10-01T11:00Z", "a", "s2"),
    ];
    expect(orderedFunnel(rows, ["a", "b"], "install", 24)[1].count).toBe(1);
    expect(orderedFunnel(rows, ["a", "b"], "session", 24)[1].count).toBe(0);
  });
  it("anonymous IDs never merge across apps; missing IDs do not become users", () => {
    const rows = [
      e("1", "a", "2026-10-01T10:00Z", "same", "s", "pois"),
      e("2", "b", "2026-10-01T11:00Z", "same", "s", "innertype"),
      e("3", "a", "2026-10-01T10:00Z", null),
    ];
    expect(
      orderedFunnel(rows, ["a", "b"], "install", 24).map((r) => r.count),
    ).toEqual([1, 0]);
  });
  it("deduplicates app-scoped IDs, removes dev/invalid events, canonicalizes event time", () => {
    const a = e("1", "a", "2026-10-01T11:00:00+02:00"),
      b = e("2", "b", "2026-10-01T09:30:00Z");
    const r = normalizeEvents([
      b,
      a,
      a,
      { ...e("3", "a", "bad"), environment: "dev" },
    ]);
    expect(r.duplicates).toBe(1);
    expect(r.invalid).toBe(1);
    expect(r.facts[0].name).toBe("a");
    expect(orderedFunnel(r.facts, ["a", "b"], "install", 24)[1].count).toBe(1);
  });
  it("path edges contain observed transitions and a distinct observation boundary", () => {
    const r = pathTransitions(
      [e("1", "a", "2026-10-01T10:00Z"), e("2", "b", "2026-10-01T10:01Z")],
      "a",
      "install",
      3,
      24,
    );
    expect(r.edges.map((x) => x.to)).toEqual(["b", "No next event"]);
    expect(r.edges[0].identities).toBe(1);
  });
  it("reverse paths follow actual preceding observations", () => {
    const r = pathTransitions(
      [e("1", "a", "2026-10-01T10:00Z"), e("2", "b", "2026-10-01T10:01Z")],
      "b",
      "install",
      2,
      24,
      "previous",
    );
    expect(r.edges[0].to).toBe("a");
  });
  it("D1 counts a distinct returning install only once; D30 remains immature", () => {
    const rows = [
      e("1", "first_open", "2026-10-01T10:00Z"),
      e("2", "session_completed", "2026-10-02T10:00Z"),
      e("3", "session_completed", "2026-10-02T11:00Z"),
      e("4", "first_open", "2026-10-01T11:00Z", "b"),
    ];
    const r = retention(
      rows,
      "pois",
      "DE",
      "2026-10-08",
      "2026-10-01",
      "2026-10-01",
    )[0];
    expect(r.size).toBe(2);
    expect(r.cells[0].rate).toBe(0.5);
    expect(r.cells[1].rate).toBe(0);
    expect(r.cells[2].rate).toBeNull();
    expect(r.cells[2].mature).toBe(false);
  });
  it("incomplete cohort or return dates are unavailable, not zero", () => {
    const rows = [e("1", "first_open", "2026-10-01T10:00Z")];
    const r = retention(
      rows,
      "pois",
      "DE",
      "2026-10-08",
      "2026-10-01",
      "2026-10-01",
      "session_completed",
      new Set(["2026-10-01"]),
    )[0];
    expect(r.cells[0].returned).toBeNull();
    expect(r.cells[0].complete).toBe(false);
  });
});
describe("source, scope and safety contracts", () => {
  it("roundtrips filters, selections, funnel definition, identity and custom dates", () => {
    const s = {
      ...scope(),
      app: "innertype" as const,
      selected: ["k3"],
      identity: "session" as const,
      direction: "previous" as const,
      start: "2026-09-20",
      funnel: ["test_started", "test_completed"],
      productTab: "funnels" as const,
    };
    expect(parseScope(scopeParams(s))).toEqual(s);
    expect(priorWindow(s)).toEqual({ start: "2026-08-29", end: "2026-09-19" });
  });
  it("invalid scope values do not create arbitrary dates or app identities", () => {
    const s = parseScope(
      new URLSearchParams(
        "app=unknown&end=2026-99-99&horizon=99999&selected=k0,evil,k7",
      ),
    );
    expect(s.app).toBe("pois");
    expect(s.end).toBe("2026-10-11");
    expect(s.horizon).toBe(24);
    expect(s.selected).toEqual(["k0", "k7"]);
  });
  it("fixture access is development-only and explicitly requested", () => {
    expect(
      fixturePreviewAllowed(
        { NODE_ENV: "production", KOPA_SIGNAL_FIXTURES: "1" },
        true,
      ),
    ).toBe(false);
    expect(
      fixturePreviewAllowed(
        { NODE_ENV: "development", KOPA_SIGNAL_FIXTURES: "1" },
        false,
      ),
    ).toBe(false);
    expect(
      fixturePreviewAllowed(
        { NODE_ENV: "development", KOPA_SIGNAL_FIXTURES: "1" },
        true,
      ),
    ).toBe(true);
  });
  it("rank math excludes legacy, absence and failed collections", () => {
    const r = rankSummary(
      [
        {
          date: "2026-10-01",
          rank: 24,
          status: "observed",
          method: "vendor_sample",
          depth: 100,
        },
        {
          date: "2026-10-02",
          rank: null,
          status: "absent",
          method: "vendor_sample",
          depth: 100,
        },
        {
          date: "2026-10-03",
          rank: null,
          status: "failed",
          method: "vendor_sample",
          depth: 100,
        },
        {
          date: "2026-10-04",
          rank: 1,
          status: "observed",
          method: "itunes_legacy",
          depth: 200,
        },
      ],
      { start: "2026-10-01", end: "2026-10-04" },
    );
    expect(r.mean).toBe(24);
    expect(r.collected).toBe(2);
    expect(rankScale(1)).toBeLessThan(rankScale(24));
  });
  it("CPA and unknown baseline do not invent money", () => {
    expect(cpa(100, 5)).toBe(20);
    expect(cpa(1, 0)).toBeNull();
  });
  it("UI, typed endpoint and export share exactly the same funnel definitions", () => {
    const d = buildSampleSnapshot({
      ...scope(),
      funnel: ["first_open", "session_completed"],
    });
    const rows = snapshotExport(d, "funnels");
    expect(rows.map((r) => ("count" in r ? r.count : null))).toEqual(
      d.funnel.map((r) => r.count),
    );
    expect(
      rows.every((r) => r.sample && r.definitionVersion === "signal-v1"),
    ).toBe(true);
    expect(d.funnel.every((r) => r.count <= d.funnel[0].count)).toBe(true);
  });
  it("paid drilldown export reconciles with the displayed series, including query filtering", () => {
    const s = {
        ...scope(),
        adsLevel: "term" as const,
        parent: "/1/0",
        query: "airpods",
      },
      d = buildSampleSnapshot(s),
      rows = snapshotExport(d, "ads");
    expect(d.paidRows).toHaveLength(1);
    const total = rows.reduce(
        (sum, r) => sum + ("spend" in r ? Number(r.spend) : 0),
        0,
      ),
      w = windowFor(s);
    expect(total).toBeCloseTo(
      d.paidSeries
        .filter((r) => r.date >= w.start && r.date <= w.end)
        .reduce((sum, r) => sum + r.spend, 0),
      8,
    );
  });
  it("event snapshots do not include other markets, apps or unselected cohorts", () => {
    const d = buildSampleSnapshot({
      ...scope(),
      app: "lovetype",
      country: "US",
    });
    expect(
      d.events.every((e) => e.app === "lovetype" && e.country === "US"),
    ).toBe(true);
    expect(
      scopedEvents(d.events, { ...d.scope, cohort: "2026-10-11" }).every((e) =>
        e.installId?.includes("-63-"),
      ),
    ).toBe(true);
  });
  it("CSV retains null/unknown values, delimiters and source definitions", () => {
    expect(toCSV([{ name: 'a,"b"', rank: null, status: "failed" }])).toContain(
      '"a,""b"""',
    );
  });
  it("explicit themes override OS while System follows it", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("interactive view and export regression", () => {
  it("preceding paths export the same direction as the visible flow", () => {
    const d = buildSampleSnapshot({
      ...scope(),
      direction: "previous",
      startEvent: "session_completed",
    });
    const rows = snapshotExport(d, "paths");
    expect(rows.map((r) => ("to" in r ? r.to : null))).toEqual(
      d.paths.edges.map((e) => e.to),
    );
    expect(rows.every((r) => r.pathDirection === "previous")).toBe(true);
    expect(d.paths.edges.some((e) => e.to === "session_started")).toBe(true);
  });
  it("human event search and plotted keyword exports match their displayed definitions", () => {
    const d = buildSampleSnapshot({ ...scope(), query: "Session completed" });
    expect(snapshotExport(d, "events")).toHaveLength(1);
    expect(snapshotExport(d, "keywords")).toHaveLength(56);
  });
  it("InnerType retention uses its observed session_end event vocabulary", () => {
    const d = buildSampleSnapshot({ ...scope(), app: "innertype" });
    expect(d.metadata.returnEvent).toBe("session_end");
    expect(d.events.some((e) => e.name === "session_end")).toBe(true);
    expect(d.events.some((e) => e.name === "session_completed")).toBe(false);
    expect(d.cohorts.some((c) => c.cells[1].rate !== null)).toBe(true);
  });
  it("custom date scopes cannot expand outside the retained sample window", () => {
    expect(parseScope(new URLSearchParams("start=0001-01-01")).start).toBe("");
    expect(
      parseScope(new URLSearchParams("start=2099-01-01&end=2099-12-31")).start,
    ).toBe("");
  });
});

it("failed and empty source states cannot export fabricated observed facts", () => {
  for (const state of ["failed", "empty"] as const) {
    const d = buildSampleSnapshot({ ...scope(), state });
    for (const area of ["keywords", "ads", "overview", "events", "paths"])
      expect(snapshotExport(d, area)).toEqual([]);
  }
  const d = buildSampleSnapshot({ ...scope(), state: "partial" });
  expect(d.acquisition.some((r) => r.date === "2026-10-04")).toBe(false);
});

it("every paid attribution mode reconciles top-line downloads with chart and export", () => {
  for (const attribution of ["tap", "view", "total"] as const) {
    const d = buildSampleSnapshot({
      ...scope(),
      adsLevel: "term",
      parent: "/1/0",
      attribution,
    });
    for (const r of d.paidSeries) {
      const expected =
        attribution === "tap"
          ? r.tapDownloads
          : attribution === "view"
            ? r.viewDownloads
            : r.tapDownloads + r.viewDownloads;
      expect(r.attributedDownloads).toBe(expected);
      expect(r.cpa).toBe(expected ? r.spend / expected : null);
    }
  }
});

it("exports disclose area-specific sources and incomplete partitions", () => {
  const d = buildSampleSnapshot({ ...scope(), state: "partial" });
  expect(coverageForArea(d, "keywords").source).toContain("rank");
  expect(coverageForArea(d, "ads").source).toContain("Apple Ads");
  expect(
    snapshotExport(d, "ads").every(
      (r) => r.complete === false && r.sourceState === "partial",
    ),
  ).toBe(true);
});
