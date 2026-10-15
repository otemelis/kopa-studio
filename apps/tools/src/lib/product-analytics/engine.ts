import {
  HORIZON_MS,
  dateWindow,
  day,
  offsetDay,
  type CatalogEntry,
  type ProductEvent,
  type ProductScope,
  type SourceManifest,
} from "./contracts";
const unique = <T>(xs: T[]) => new Set(xs).size;
const time = (e: ProductEvent) => Date.parse(e.time);
const prop = (e: ProductEvent, name: string) =>
  typeof e.properties[name] === "string"
    ? String(e.properties[name])
    : "unknown";
const sessionKey = (e: ProductEvent) => e.app + ":" + e.sessionId;
const rate = (n: number, d: number) => (d ? n / d : null);
export const FUNNELS = {
  assessment: ["assessment_started", "assessment_completed", "result_viewed"],
  purchase: ["paywall_viewed", "purchase_tapped", "purchase_success"],
};
function groupSessions(events: ProductEvent[]) {
  const groups = new Map<string, ProductEvent[]>();
  for (const e of events) {
    const k = sessionKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  for (const values of groups.values())
    values.sort((a, b) => time(a) - time(b));
  return groups;
}
/** Count a recorded session once per reached step. Every chain retains the starting assessment type. */
export function sessionFunnel(
  events: ProductEvent[],
  scope: ProductScope,
  start: number,
  end: number,
  cutoff: number,
) {
  const steps = FUNNELS[scope.funnel],
    counts = [0, 0, 0];
  let censored = 0,
    missingTypeEntries = 0,
    equalTimeCandidates = 0;
  for (const values of groupSessions(events).values()) {
    const entries = values.filter(
      (e) => e.name === steps[0] && time(e) >= start && time(e) < end,
    );
    if (!entries.length) continue;
    let best = 1;
    if (entries.every((e) => time(e) + HORIZON_MS > cutoff)) censored++;
    for (const entry of entries) {
      const type = prop(entry, "assessment_type");
      if (scope.funnel === "assessment" && type === "unknown") {
        missingTypeEntries++;
        continue;
      }
      let reached = 1,
        at = time(entry);
      for (const step of steps.slice(1)) {
        const candidates = values.filter(
          (e) =>
            e.name === step &&
            time(e) >= at &&
            time(e) <= time(entry) + HORIZON_MS &&
            (scope.funnel !== "assessment" ||
              prop(e, "assessment_type") === type),
        );
        if (candidates.some((e) => time(e) === at)) equalTimeCandidates++;
        const next = candidates.find((e) => time(e) > at);
        if (!next) break;
        reached++;
        at = time(next);
      }
      best = Math.max(best, reached);
    }
    for (let i = 0; i < best; i++) counts[i]++;
  }
  return {
    steps: steps.map((name, i) => ({
      name,
      sessions: counts[i],
      conversion: rate(counts[i], counts[0]),
      fromPrevious: i ? rate(counts[i], counts[i - 1]) : null,
      lost: i ? counts[i - 1] - counts[i] : 0,
    })),
    censored,
    missingTypeEntries,
    equalTimeCandidates,
  };
}
const meaningful = new Set([
  "app_opened",
  "assessment_started",
  "assessment_completed",
  "result_viewed",
  "assessment_exited",
  "assessment_abandoned",
  "paywall_viewed",
  "purchase_tapped",
  "purchase_success",
  "purchase_cancelled",
  "share_card_viewed",
  "share_card_shared",
]);
export type JourneyNode = {
  key: string;
  name: string;
  sessions: number;
  children: JourneyNode[];
};
export function sessionJourney(
  events: ProductEvent[],
  scope: ProductScope,
  start: number,
  end: number,
  cutoff: number,
) {
  const root: JourneyNode = {
    key: "root",
    name: scope.journey,
    sessions: 0,
    children: [],
  };
  for (const values of groupSessions(events).values()) {
    const entry = values.find(
      (e) => e.name === scope.journey && time(e) >= start && time(e) < end,
    );
    if (!entry) continue;
    root.sessions++;
    let node = root,
      at = time(entry),
      last = entry.name;
    const type = prop(entry, "assessment_type");
    for (let depth = 0; depth < 3; depth++) {
      const candidates = values.filter(
        (e) =>
          meaningful.has(e.name) &&
          e.name !== last &&
          time(e) >= at &&
          time(e) <= time(entry) + HORIZON_MS &&
          (scope.journey !== "assessment_started" ||
            prop(e, "assessment_type") === "unknown" ||
            prop(e, "assessment_type") === type),
      );
      const tied = candidates.filter((e) => time(e) === at);
      const next = candidates.find((e) => time(e) > at);
      let name = tied.length
        ? "Ambiguous event order"
        : next
          ? next.name
          : time(entry) + HORIZON_MS > cutoff
            ? "Observation still open"
            : "No next recorded step";
      if (scope.journey === "assessment_started" && type === "unknown")
        name = "Missing assessment type";
      if (
        next &&
        candidates.some((e) => time(e) === time(next) && e.name !== next.name)
      )
        name = "Ambiguous event order";
      let child = node.children.find((n) => n.name === name);
      if (!child) {
        child = { key: node.key + "/" + name, name, sessions: 0, children: [] };
        node.children.push(child);
      }
      child.sessions++;
      node = child;
      if (!next || name !== next.name) break;
      at = time(next);
      last = next.name;
    }
  }
  const sort = (n: JourneyNode) => {
    n.children.sort(
      (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name),
    );
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}
function matches(e: ProductEvent, s: ProductScope) {
  return (
    (s.country === "ALL" || e.country === s.country) &&
    (s.version === "ALL" || e.version === s.version) &&
    (s.language === "ALL" || prop(e, "language") === s.language) &&
    (s.source === "ALL" || prop(e, "source") === s.source) &&
    (s.assessment === "ALL" || prop(e, "assessment_type") === s.assessment)
  );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export function auditQuality(events: ProductEvent[], catalog: CatalogEntry[]) {
  const first = new Set(
    events.filter((e) => e.name === "app_first_open").map((e) => e.anonymousId),
  );
  const lags = events
    .map((e) => (Date.parse(e.received) - time(e)) / 1000)
    .sort((a, b) => a - b);
  // A duplicate candidate is identical in all original event fields except database id and receive time.
  const fingerprints = events.map((e) =>
    canonical({
      app: e.app,
      environment: e.environment,
      name: e.name,
      anonymousId: e.anonymousId,
      sessionId: e.sessionId,
      time: e.time,
      country: e.country,
      version: e.version,
      platform: e.platform,
      osVersion: e.osVersion,
      properties: e.properties,
    }),
  );
  const missingProperties = events.reduce(
    (n, e) =>
      n +
      (catalog.find((c) => c.name === e.name)?.required || []).filter(
        (k) => e.properties[k] == null,
      ).length,
    0,
  );
  return {
    rows: events.length,
    sessions: groupSessions(events).size,
    anonymousIds: unique(events.map((e) => e.anonymousId)),
    fragmentedSessions: [...groupSessions(events).values()].filter(
      (es) => unique(es.map((e) => e.anonymousId)) > 1,
    ).length,
    idsWithFirstOpen: first.size,
    idsWithoutFirstOpen: unique(events.map((e) => e.anonymousId)) - first.size,
    possibleDuplicateRows: events.length - unique(fingerprints),
    missingRequiredProperties: missingProperties,
    unknownCatalogRows: events.filter(
      (e) => !catalog.some((c) => c.name === e.name),
    ).length,
    lagMedianSeconds: lags.length ? lags[Math.floor(lags.length / 2)] : null,
    lagP99Seconds: lags.length ? lags[Math.ceil(lags.length * 0.99) - 1] : null,
    lagMaxSeconds: lags.at(-1) ?? null,
    firstEvent: events.length
      ? new Date(Math.min(...events.map(time))).toISOString()
      : null,
    lastEvent: events.length
      ? new Date(Math.max(...events.map(time))).toISOString()
      : null,
    lastReceived: events.length
      ? new Date(
          Math.max(...events.map((e) => Date.parse(e.received))),
        ).toISOString()
      : null,
    observedDays: unique(events.map((e) => day(e.time))),
    schemaVersion: "legacy-unversioned" as const,
    userMetricsAvailable: false as const,
    reason:
      "Anonymous identity continuity is unverified; first-open coverage is incomplete. This legacy contract has no identity repair evidence, stable event UUID or schema version.",
  };
}
export function buildProductReport(
  all: ProductEvent[],
  catalog: CatalogEntry[],
  manifest: SourceManifest,
  scope: ProductScope,
) {
  if (scope.app !== "innertype")
    throw new Error("This source is validated for InnerType only.");
  const prod = all.filter(
    (e) =>
      e.app === scope.app &&
      e.environment === "prod" &&
      Date.parse(e.received) <= Date.parse(manifest.cutoff),
  );
  const quality = auditQuality(prod, catalog);
  const scoped = prod.filter((e) => matches(e, scope));
  const w = dateWindow(scope),
    cutoff = Date.parse(manifest.cutoff);
  const current = scoped.filter((e) => time(e) >= w.start && time(e) < w.end);
  const previous = scoped.filter(
    (e) => time(e) >= w.previousStart && time(e) < w.previousEnd,
  );
  const names = [
    ...new Set([...catalog.map((c) => c.name), ...prod.map((e) => e.name)]),
  ].sort();
  const metrics = (es: ProductEvent[]) => ({
    events: es.length,
    sessions: unique(es.map(sessionKey)),
    purchaseSignals: es.filter((e) => e.name === "purchase_success").length,
    observedDays: unique(es.map((e) => day(e.time))),
  });
  const eventRows = names
    .filter((name) => name.includes(scope.query.toLowerCase()))
    .map((name) => {
      const es = current.filter((e) => e.name === name),
        ps = previous.filter((e) => e.name === name);
      return {
        name,
        events: es.length,
        previousEvents: ps.length,
        sessions: unique(es.map(sessionKey)),
        lastSeen: es.length
          ? new Date(Math.max(...es.map(time))).toISOString()
          : null,
        catalogued: catalog.some((c) => c.name === name),
      };
    })
    .sort((a, b) => b.events - a.events || a.name.localeCompare(b.name));
  const days = Math.round((w.end - w.start) / HORIZON_MS);
  const trend = Array.from({ length: days }, (_, i) => {
    const date = offsetDay(scope.start, i),
      priorDate = offsetDay(day(new Date(w.previousStart).toISOString()), i);
    const es = current.filter((e) => day(e.time) === date),
      ps = previous.filter((e) => day(e.time) === priorDate);
    return {
      date,
      priorDate,
      events: es.length || null,
      sessions: es.length ? unique(es.map(sessionKey)) : null,
      previousEvents: ps.length || null,
      previousSessions: ps.length ? unique(ps.map(sessionKey)) : null,
    };
  });
  const values = (get: (e: ProductEvent) => string) =>
    [...new Set(prod.map(get))].filter((v) => v).sort();
  return {
    contract: "kopa.product.observed-session.v1" as const,
    scope,
    source: {
      project: manifest.project,
      app: manifest.app,
      asOf: manifest.cutoff,
      mode: "restored-read-only-snapshot" as const,
      hash: manifest.tables.events.sha256,
      sourceRows: manifest.tables.events.rows,
      loadedRows: all.length,
      excludedNonProduction: all.filter((e) => e.environment !== "prod").length,
      fullClusterBackupVerified: false,
    },
    comparison: {
      start: day(new Date(w.previousStart).toISOString()),
      end: day(new Date(w.previousEnd - 1).toISOString()),
      definition:
        "Previous equal-length UTC period; incomplete coverage, observed counts only",
    },
    filters: {
      countries: values((e) => e.country),
      versions: values((e) => e.version),
      languages: values((e) => prop(e, "language")),
      sources: values((e) => prop(e, "source")),
      assessments: values((e) => prop(e, "assessment_type")),
    },
    metrics: metrics(current),
    previous: metrics(previous),
    trend,
    funnel: sessionFunnel(scoped, scope, w.start, w.end, cutoff),
    previousFunnel: sessionFunnel(
      scoped,
      scope,
      w.previousStart,
      w.previousEnd,
      cutoff,
    ),
    journey: sessionJourney(scoped, scope, w.start, w.end, cutoff),
    eventRows,
    quality,
    segmentation:
      "Filters apply to individual captured events, including every funnel/path step. Session counts may overlap across segments. Region is a captured country/region code; source is an unverified client tag.",
    limitations: [
      "Recorded sessions are not users or installs. No identity stitching is performed.",
      "Events have no logical event UUID: raw event counts retain possible retry duplicates; session steps count once per recorded session.",
      "No coverage heartbeat: missing dates are gaps, not verified zero activity. Recent observations can arrive late.",
      "Purchase success is a client signal; verified transactions, refunds, proceeds and revenue are unavailable.",
    ],
  };
}
export type ProductReport = ReturnType<typeof buildProductReport>;
