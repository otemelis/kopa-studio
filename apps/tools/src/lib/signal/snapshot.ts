import {
  ENTRY_EVENTS,
  RETURN_EVENTS,
  priorWindow,
  shift,
  type SignalScope,
  windowFor,
} from "./contracts";
import {
  ALL_SAMPLE_EVENTS,
  JOURNEYS,
  keywordFixture,
  acquisitionFixture,
  human,
} from "./fixtures";
import {
  orderedFunnel,
  pathTransitions,
  retention,
  scopedEvents,
  eventSummary,
} from "./product-engine";
import { rankComparison } from "./analytics";
export function buildSampleSnapshot(scope: SignalScope) {
  const all =
      scope.state === "empty" || scope.state === "failed"
        ? []
        : scope.state === "partial"
          ? ALL_SAMPLE_EVENTS.filter((e) => e.at.slice(0, 10) !== "2026-10-04")
          : ALL_SAMPLE_EVENTS,
    events = scopedEvents(all, scope),
    completeThrough =
      scope.state === "stale" ? shift(scope.end, -5) : scope.end;
  const usable = events.filter((e) => e.at.slice(0, 10) <= completeThrough),
    steps =
      scope.funnel.length >= 2 &&
      scope.funnel.every((n) => JOURNEYS[scope.app].includes(n))
        ? scope.funnel
        : JOURNEYS[scope.app],
    startEvent = JOURNEYS[scope.app].includes(scope.startEvent)
      ? scope.startEvent
      : steps[0],
    current = windowFor(scope),
    prior = priorWindow(scope),
    keywords =
      scope.state === "empty" || scope.state === "failed"
        ? []
        : keywordFixture(scope);
  const previousEvents = scopedEvents(all, {
    ...scope,
    start: prior.start,
    end: prior.end,
    cohort: "",
  });
  const priorComparable = prior.start >= "2026-08-09";
  const cohorts = retention(
    all,
    scope.app,
    scope.country,
    completeThrough,
    current.start > "2026-08-09" ? current.start : "2026-08-09",
    scope.end,
    RETURN_EVENTS[scope.app],
    scope.state === "partial"
      ? new Set(
          ALL_SAMPLE_EVENTS.map((e) => e.at.slice(0, 10)).filter(
            (d) => d !== "2026-10-04",
          ),
        )
      : undefined,
    ENTRY_EVENTS[scope.app],
  );
  const acquisition = (
    scope.state === "empty" || scope.state === "failed"
      ? []
      : acquisitionFixture(scope).filter(
          (r) =>
            (scope.state !== "partial" || r.date !== "2026-10-04") &&
            (scope.state !== "stale" || r.date <= completeThrough),
        )
  ).map((r) => {
    const attributedDownloads =
      scope.attribution === "tap"
        ? r.tapDownloads
        : scope.attribution === "view"
          ? r.viewDownloads
          : r.tapDownloads + r.viewDownloads;
    return {
      ...r,
      attributedDownloads,
      cpa: attributedDownloads ? r.spend / attributedDownloads : null,
    };
  });
  const names =
    scope.adsLevel === "campaign"
      ? [
          "Brand · Search results",
          "Discovery · Search Match",
          "Generic · Exact",
        ]
      : scope.adsLevel === "group"
        ? ["Core audience", "Discovery audience"]
        : [
            "posture reminder",
            "airpods posture",
            "neck posture",
            "sit straight",
            "desk posture",
          ].map((n) => (scope.adsLevel === "term" ? n + " app" : n));
  const shares =
    scope.adsLevel === "campaign"
      ? [0.22, 0.47, 0.31]
      : scope.adsLevel === "group"
        ? [0.65, 0.35]
        : scope.adsLevel === "term"
          ? [0.28, 0.22, 0.19, 0.14, 0.1]
          : [0.3, 0.25, 0.2, 0.15, 0.1];
  const parent = scope.parent
    .split("/")
    .filter(Boolean)
    .reduce(
      (v, id, i) =>
        v *
        (i === 0
          ? ([0.22, 0.47, 0.31][Number(id)] ?? 1)
          : ([0.65, 0.35][Number(id)] ?? 1)),
      1,
    );
  const paidRows = names
    .map((name, i) => ({
      id: String(i),
      name,
      points: acquisition.map((r) => {
        const factor = shares[i] * parent,
          tapDownloads = Math.round(r.tapDownloads * factor),
          viewDownloads = Math.round(r.viewDownloads * factor),
          attributedDownloads =
            scope.attribution === "tap"
              ? tapDownloads
              : scope.attribution === "view"
                ? viewDownloads
                : tapDownloads + viewDownloads,
          spend = +(r.spend * factor).toFixed(2);
        return {
          ...r,
          downloads: 0,
          proceeds: 0,
          spend,
          taps: Math.round(r.taps * factor),
          tapDownloads,
          viewDownloads,
          attributedDownloads,
          cpa: attributedDownloads ? spend / attributedDownloads : null,
        };
      }),
    }))
    .filter((r) => r.name.toLowerCase().includes(scope.query.toLowerCase()));
  const paidSeries = acquisition.map((r) => {
    const v = paidRows.reduce(
      (a, row) => {
        const p = row.points.find((p) => p.date === r.date)!;
        return {
          spend: a.spend + p.spend,
          taps: a.taps + p.taps,
          tapDownloads: a.tapDownloads + p.tapDownloads,
          viewDownloads: a.viewDownloads + p.viewDownloads,
          attributedDownloads: a.attributedDownloads + p.attributedDownloads,
        };
      },
      {
        spend: 0,
        taps: 0,
        tapDownloads: 0,
        viewDownloads: 0,
        attributedDownloads: 0,
      },
    );
    return {
      ...r,
      ...v,
      cpa: v.attributedDownloads ? v.spend / v.attributedDownloads : null,
    };
  });
  const coverage = {
    source: "Independent synthetic event fixture",
    method: "ordered observed events",
    unit:
      scope.identity === "install"
        ? "anonymous app installations"
        : "app-scoped sessions",
    completeThrough,
    timezone: "UTC" as const,
    complete: scope.state === "complete" && current.start >= "2026-08-09",
    sample: true,
    definitionVersion: "signal-v1" as const,
    warnings: [
      "Fixtures only; no live source connected.",
      "Anonymous installations are not people.",
      "Client purchase signals are not settled revenue.",
      "Event coverage starts 2026-08-09; earlier history is unavailable.",
      ...(scope.state === "partial"
        ? [
            "Collection incomplete on 4 October; affected retention cells are unavailable.",
          ]
        : []),
    ],
  };
  const funnel = orderedFunnel(
      usable,
      steps,
      scope.identity,
      scope.horizon,
      completeThrough + "T23:59:59.999Z",
    ),
    previousFunnel = orderedFunnel(
      previousEvents,
      steps,
      scope.identity,
      scope.horizon,
      prior.end + "T23:59:59.999Z",
    ),
    paths = pathTransitions(
      usable,
      startEvent,
      scope.identity,
      scope.steps,
      scope.horizon,
      scope.direction,
    ),
    summaries = eventSummary(usable);
  const metadata = {
    sample: true,
    app: scope.app,
    country: scope.country,
    current,
    prior: scope.compare ? prior : null,
    identity: scope.identity,
    horizonHours: scope.horizon,
    pathDirection: scope.direction,
    startEvent,
    returnEvent: RETURN_EVENTS[scope.app],
    entryEvent: ENTRY_EVENTS[scope.app],
    completeThrough,
    definitionVersion: "signal-v1",
    source: coverage.source,
    timezone: "UTC",
    cohort: scope.cohort || "all observed first-open cohorts",
  };
  return {
    scope,
    metadata,
    coverage,
    priorComparable,
    events: usable,
    keywords,
    keywordStats: keywords.map((k) => ({
      id: k.id,
      ...rankComparison(k, scope),
    })),
    acquisition,
    paidRows,
    paidSeries,
    funnel,
    previousFunnel,
    paths,
    cohorts,
    eventSummary: summaries,
  };
}
export type SignalSnapshot = ReturnType<typeof buildSampleSnapshot>;
export function coverageForArea(data: SignalSnapshot, area: string) {
  if (["paths", "funnels", "retention", "events", "product"].includes(area))
    return data.coverage;
  const w = data.metadata.current,
    expected = windowFor(data.scope),
    source =
      area === "keywords"
        ? "Synthetic rank observations"
        : area === "ads"
          ? "Synthetic Apple Ads report"
          : area === "overview"
            ? "Synthetic ASC report"
            : "Synthetic planning / source-state fixture";
  const selected = data.keywordStats.filter((k) =>
    data.scope.selected.includes(k.id),
  );
  const complete =
    area === "keywords"
      ? selected.length > 0 &&
        selected.every((k) => k.current.collected === k.current.expected)
      : ["ads", "overview"].includes(area)
        ? data.acquisition.filter((r) => r.date >= w.start && r.date <= w.end)
            .length ===
          Math.round(
            (Date.parse(expected.end) - Date.parse(expected.start)) / 86400000,
          ) +
            1
        : false;
  return {
    ...data.coverage,
    source,
    method:
      area === "keywords"
        ? "separate method-labeled observations"
        : area === "ads"
          ? "native currency and selected attribution"
          : "daily report or recorded annotation",
    unit:
      area === "keywords"
        ? "rank positions"
        : area === "ads"
          ? "native EUR / attributed downloads"
          : "report measures",
    complete: complete && data.scope.state === "complete",
    warnings: [
      "Synthetic fixtures only; no live account connection.",
      ...(data.scope.state !== "complete"
        ? ["Selected source state: " + data.scope.state]
        : []),
    ],
  };
}
export function snapshotExport(data: SignalSnapshot, area: string) {
  if (data.scope.state === "failed" || data.scope.state === "empty") return [];
  const meta = {
    ...data.metadata,
    source: coverageForArea(data, area).source,
    complete: coverageForArea(data, area).complete,
    sourceState: data.scope.state,
    coverageWarnings: coverageForArea(data, area).warnings.join(" | "),
    currentStart: data.metadata.current.start,
    currentEnd: data.metadata.current.end,
    priorStart: data.metadata.prior?.start ?? "",
    priorEnd: data.metadata.prior?.end ?? "",
    current: undefined,
    prior: undefined,
    filter: data.scope.query,
    view: area,
  };
  if (area === "sources")
    return [
      {
        ...meta,
        sourceState: data.scope.state,
        complete: data.coverage.complete,
        warnings: data.coverage.warnings.join(" | "),
        definition:
          "Preview source coverage only; no account connection implied",
      },
    ];
  if (area === "experiments")
    return [
      {
        ...meta,
        annotation: "Metadata v1.8",
        date: "2026-09-23",
        status: "Sample; observational; no causal inference",
      },
      {
        ...meta,
        annotation: "Screenshot test",
        date: "2026-10-03",
        status: "Sample; awaiting data",
      },
      {
        ...meta,
        annotation: "Budget review",
        date: "2026-10-07",
        status: "Sample; reviewed",
      },
    ].filter(
      (r) =>
        r.date >= data.metadata.current.start &&
        r.date <= data.metadata.current.end,
    );
  if (area === "keywords")
    return data.keywords
      .filter((k) => data.scope.selected.includes(k.id))
      .flatMap((k) =>
        k.points
          .filter(
            (p) =>
              p.date >= data.metadata.current.start &&
              p.date <= data.metadata.current.end,
          )
          .map((p) => ({ ...meta, keyword: k.name, ...p })),
      );
  if (area === "ads")
    return data.paidRows.flatMap((r) =>
      r.points
        .filter(
          (p) =>
            p.date >= data.metadata.current.start &&
            p.date <= data.metadata.current.end,
        )
        .map((p) => ({
          ...meta,
          ...p,
          name: r.name,
          level: data.scope.adsLevel,
          parent: data.scope.parent,
          attribution: data.scope.attribution,
          currency: "EUR",
          suppressed: data.scope.adsLevel === "term",
          source: "synthetic Apple Ads report",
          definition:
            "Native EUR; ratio-of-totals CPA; reported terms may be suppressed",
        })),
    );
  if (area === "retention")
    return data.cohorts
      .filter((r) => !data.scope.cohort || r.date === data.scope.cohort)
      .flatMap((r) =>
        r.cells.map((c) => ({
          ...meta,
          cohort: r.date,
          size: r.size,
          ...c,
          definition: `exact-day ${RETURN_EVENTS[data.scope.app]} return from ${ENTRY_EVENTS[data.scope.app]}; installation identity`,
        })),
      );
  if (area === "paths")
    return data.paths.edges.map((e) => ({
      ...meta,
      ...e,
      definition:
        "first matching start per identity; no next event is an observation boundary",
    }));
  if (area === "funnels")
    return data.funnel.map((r, i) => ({
      ...meta,
      ...r,
      priorCount:
        data.scope.compare && data.priorComparable
          ? data.previousFunnel[i]?.count
          : null,
      definition:
        "closed ordered funnel; one conversion per identity within horizon",
    }));
  if (area === "events")
    return data.eventSummary
      .filter((e) =>
        human(e.name).toLowerCase().includes(data.scope.query.toLowerCase()),
      )
      .map((e) => ({
        ...meta,
        ...e,
        versions: e.versions.join("|"),
        countries: e.countries.join("|"),
      }));
  return data.acquisition
    .filter(
      (r) =>
        r.date >= data.metadata.current.start &&
        r.date <= data.metadata.current.end,
    )
    .map((r) => ({
      ...meta,
      ...r,
      attribution: data.scope.attribution,
      currency: "EUR",
      definition:
        "synthetic report values; client purchase signal excluded from proceeds",
    }));
}
