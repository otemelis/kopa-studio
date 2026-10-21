import {
  DAY,
  ENTRY_EVENTS,
  dates,
  shift,
  type EventFact,
  type Identity,
  type SignalScope,
  windowFor,
} from "./contracts";
const key = (e: EventFact, identity: Identity) =>
  identity === "install"
    ? e.installId
    : e.sessionId && e.installId
      ? `${e.installId}:${e.sessionId}`
      : null;
export function normalizeEvents(events: EventFact[]) {
  const seen = new Set<string>();
  let duplicates = 0,
    invalid = 0;
  const facts = events
    .filter((e) => {
      if (
        !e.id ||
        !Number.isFinite(Date.parse(e.at)) ||
        e.environment !== "prod"
      ) {
        invalid++;
        return false;
      }
      const id = e.app + ":" + e.id;
      if (seen.has(id)) {
        duplicates++;
        return false;
      }
      seen.add(id);
      return true;
    })
    .map((e) => ({ ...e, at: new Date(e.at).toISOString() }))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return {
    facts,
    duplicates,
    invalid,
    missingInstall: facts.filter((e) => !e.installId).length,
    missingSession: facts.filter((e) => !e.sessionId).length,
  };
}
export function scopedEvents(
  events: EventFact[],
  s: SignalScope,
  cohortFilter = true,
) {
  const w = windowFor(s),
    normalized = normalizeEvents(events).facts;
  const starters =
    cohortFilter && s.cohort
      ? new Set(
          normalized
            .filter(
              (e) =>
                e.app === s.app &&
                e.country === s.country &&
                e.name === ENTRY_EVENTS[s.app] &&
                e.at.slice(0, 10) === s.cohort,
            )
            .map((e) => e.installId),
        )
      : null;
  return normalized.filter(
    (e) =>
      e.app === s.app &&
      e.country === s.country &&
      e.at >= w.start &&
      e.at < shift(w.end, 1) &&
      (!starters || starters.has(e.installId)),
  );
}
/** Ordered closed funnel, one conversion per identity, within a fixed window from first entry.
 * Repeated entry attempts are eligible, but an out-of-order step never counts. */
export function orderedFunnel(
  events: EventFact[],
  names: string[],
  identity: Identity,
  hours: number,
  matureThrough?: string,
) {
  const groups = new Map<string, EventFact[]>();
  for (const e of normalizeEvents(events).facts) {
    const id = key(e, identity);
    if (!id) continue;
    const arr = groups.get(e.app + ":" + id) ?? [];
    arr.push(e);
    groups.set(e.app + ":" + id, arr);
  }
  const counts = names.map(() => 0),
    durations = names.map(() => [] as number[]);
  for (const group of groups.values()) {
    let best = 0,
      bestTimes: number[] = [];
    for (let start = 0; start < group.length; start++) {
      if (
        group[start].name !== names[0] ||
        (matureThrough &&
          Date.parse(group[start].at) + hours * 3_600_000 >
            Date.parse(matureThrough))
      )
        continue;
      const times = [Date.parse(group[start].at)];
      let stage = 1;
      for (let i = start + 1; i < group.length && stage < names.length; i++) {
        const t = Date.parse(group[i].at);
        if (t - times[0] > hours * 3_600_000) break;
        if (group[i].name === names[stage]) {
          times.push(t);
          stage++;
        }
      }
      if (stage > best) {
        best = stage;
        bestTimes = times;
      }
    }
    for (let i = 0; i < best; i++) {
      counts[i]++;
      if (i) durations[i].push((bestTimes[i] - bestTimes[i - 1]) / 60000);
    }
  }
  return names.map((name, i) => {
    const times = durations[i].sort((a, b) => a - b);
    return {
      name,
      count: counts[i],
      conversion:
        i && counts[i - 1]
          ? counts[i] / counts[i - 1]
          : i === 0 && counts[0]
            ? 1
            : null,
      dropoff: i ? counts[i - 1] - counts[i] : 0,
      medianMinutes: times.length
        ? (times[Math.floor((times.length - 1) / 2)] +
            times[Math.ceil((times.length - 1) / 2)]) /
          2
        : null,
    };
  });
}
export function pathTransitions(
  events: EventFact[],
  startEvent: string,
  identity: Identity,
  maxSteps: number,
  hours: number,
  direction: "next" | "previous" = "next",
) {
  const groups = new Map<string, EventFact[]>();
  for (const e of normalizeEvents(events).facts) {
    const id = key(e, identity);
    if (!id) continue;
    const k = e.app + ":" + id;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const edges = new Map<
      string,
      {
        from: string;
        to: string;
        step: number;
        transitions: number;
        identities: Set<string>;
      }
    >(),
    nodes = new Map<
      string,
      { name: string; step: number; identities: Set<string> }
    >();
  for (const [id, g] of groups) {
    const at = g.findIndex((e) => e.name === startEvent);
    if (at < 0) continue;
    const sequence = (
      direction === "next" ? g.slice(at) : g.slice(0, at + 1).reverse()
    )
      .filter(
        (e) =>
          Math.abs(Date.parse(e.at) - Date.parse(g[at].at)) <=
          hours * 3_600_000,
      )
      .slice(0, maxSteps + 1);
    for (let i = 0; i < sequence.length; i++) {
      const name = sequence[i].name,
        k = i + ":" + name;
      const node = nodes.get(k) ?? {
        name,
        step: i,
        identities: new Set<string>(),
      };
      node.identities.add(id);
      nodes.set(k, node);
      if (i) {
        const prev = sequence[i - 1].name,
          ek = i - 1 + ":" + prev + ">" + name,
          edge = edges.get(ek) ?? {
            from: prev,
            to: name,
            step: i - 1,
            transitions: 0,
            identities: new Set<string>(),
          };
        edge.transitions++;
        edge.identities.add(id);
        edges.set(ek, edge);
      }
    }
    if (sequence.length <= maxSteps) {
      const i = sequence.length - 1,
        prev = sequence[i];
      if (prev) {
        const k = i + ":" + prev.name + ">No next event",
          edge = edges.get(k) ?? {
            from: prev.name,
            to: "No next event",
            step: i,
            transitions: 0,
            identities: new Set<string>(),
          };
        edge.transitions++;
        edge.identities.add(id);
        edges.set(k, edge);
        const nk = i + 1 + ":No next event",
          n = nodes.get(nk) ?? {
            name: "No next event",
            step: i + 1,
            identities: new Set<string>(),
          };
        n.identities.add(id);
        nodes.set(nk, n);
      }
    }
  }
  return {
    nodes: [...nodes.values()].map((n) => ({
      ...n,
      identities: n.identities.size,
    })),
    edges: [...edges.values()].map((e) => ({
      ...e,
      identities: e.identities.size,
    })),
    direction,
  };
}
/** Exact-day retention from first_open cohorts. Immature or incompletely observed cells are null. */
export function retention(
  events: EventFact[],
  app: string,
  country: string,
  completeThrough: string,
  cohortStart: string,
  cohortEnd: string,
  activity = "session_completed",
  completeDates?: Set<string>,
  entryEvent = "first_open",
) {
  const facts = normalizeEvents(events).facts.filter(
    (e) =>
      e.app === app &&
      e.country === country &&
      e.installId &&
      e.at.slice(0, 10) <= completeThrough,
  );
  const first = new Map<string, string>();
  for (const e of facts)
    if (e.name === entryEvent && !first.has(e.installId!))
      first.set(e.installId!, e.at.slice(0, 10));
  return dates(cohortStart, cohortEnd).map((date) => {
    const ids = new Set(
      [...first].filter(([, d]) => d === date).map(([id]) => id),
    );
    return {
      date,
      size: ids.size,
      cells: [1, 7, 30].map((day) => {
        const target = shift(date, day),
          mature = target <= completeThrough,
          complete =
            mature &&
            (!completeDates ||
              (completeDates.has(date) && completeDates.has(target)));
        const returned = new Set(
          facts
            .filter(
              (e) =>
                e.name === activity &&
                e.at.slice(0, 10) === target &&
                ids.has(e.installId!),
            )
            .map((e) => e.installId),
        );
        return {
          day,
          target,
          mature,
          complete,
          returned: complete ? returned.size : null,
          rate: complete && ids.size ? returned.size / ids.size : null,
        };
      }),
    };
  });
}
export function eventSummary(events: EventFact[]) {
  return [...new Set(events.map((e) => e.name))]
    .map((name) => {
      const rows = events.filter((e) => e.name === name);
      return {
        name,
        count: rows.length,
        installs: new Set(rows.map((e) => e.installId).filter(Boolean)).size,
        sessions: new Set(
          rows
            .filter((e) => e.sessionId)
            .map((e) => `${e.installId ?? "unknown"}:${e.sessionId}`),
        ).size,
        versions: [...new Set(rows.map((e) => e.version))],
        countries: [...new Set(rows.map((e) => e.country))],
      };
    })
    .sort((a, b) => b.count - a.count);
}
export function cohortStartFor(s: SignalScope) {
  return shift(s.end, -Math.min(35, s.days - 1));
}
export const durationDays = (first: string, last: string) =>
  (Date.parse(last) - Date.parse(first)) / DAY;
