/** Source-aware contracts shared by the Signal UI, export and typed read endpoint. */
export type SignalScreen =
  | "overview"
  | "keywords"
  | "ads"
  | "product"
  | "experiments"
  | "sources";
export type SampleApp = "pois" | "innertype" | "lovetype";
export type Identity = "install" | "session";
export type ProductTab = "paths" | "funnels" | "retention" | "events";
export type SignalScope = {
  app: SampleApp;
  country: "DE" | "US";
  days: 7 | 28 | 90;
  end: string;
  start: string;
  compare: boolean;
  selected: string[];
  productTab: ProductTab;
  query: string;
  startEvent: string;
  direction: "next" | "previous";
  horizon: number;
  steps: number;
  identity: Identity;
  state: "complete" | "partial" | "empty" | "stale" | "failed";
  cohort: string;
  adsLevel: "campaign" | "group" | "keyword" | "term";
  attribution: "tap" | "view" | "total";
  parent: string;
  funnel: string[];
};
export type EventFact = {
  id: string;
  app: SampleApp;
  installId: string | null;
  sessionId: string | null;
  name: string;
  at: string;
  environment: "prod" | "dev";
  version: string;
  country: "DE" | "US";
  schemaVersion: number;
  properties: { locale?: string; cue?: string; source?: string };
};
export type Coverage = {
  source: string;
  method: string;
  unit: string;
  completeThrough: string;
  timezone: "UTC";
  complete: boolean;
  sample: boolean;
  definitionVersion: "signal-v1";
  warnings: string[];
};
export type RankFact = {
  date: string;
  rank: number | null;
  status: "observed" | "absent" | "failed" | "untracked" | "stale";
  method: "vendor_sample" | "itunes_legacy";
  depth: number;
};
export type KeywordSeries = {
  id: string;
  name: string;
  intent: string;
  points: RankFact[];
};
export const SCREEN_ROUTES: Record<SignalScreen, string> = {
  overview: "/",
  keywords: "/keywords",
  ads: "/apple-ads-lab/reporting",
  product: "/analytics",
  experiments: "/experiments",
  sources: "/app-store-connect",
};
export const APP_LABELS: Record<SampleApp, string> = {
  pois: "POIS",
  innertype: "InnerType",
  lovetype: "LoveType",
};
export const ENTRY_EVENTS: Record<SampleApp, string> = {
  pois: "first_open",
  innertype: "app_first_open",
  lovetype: "first_open",
};
export const RETURN_EVENTS: Record<SampleApp, string> = {
  pois: "session_completed",
  innertype: "session_end",
  lovetype: "test_completed",
};
export const SNAPSHOT = "2026-10-11";
export const DAY = 86_400_000;
export const shift = (date: string, days: number) =>
  new Date(Date.parse(date + "T00:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
export function dates(start: string, end: string) {
  const out: string[] = [];
  for (let day = start; day <= end; day = shift(day, 1)) out.push(day);
  return out;
}
export function windowFor(scope: SignalScope) {
  return {
    start: scope.start || shift(scope.end, 1 - scope.days),
    end: scope.end,
  };
}
export function priorWindow(scope: SignalScope) {
  const w = windowFor(scope),
    n = dates(w.start, w.end).length;
  return { start: shift(w.start, -n), end: shift(w.start, -1) };
}
export function isDate(value: string | null): value is string {
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function parseScope(p: {
  get(key: string): string | null;
}): SignalScope {
  const pick = <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
  ): T => {
    const v = p.get(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  };
  const end = p.get("end");
  return {
    app: pick("app", ["pois", "innertype", "lovetype"], "pois"),
    country: pick("country", ["DE", "US"], "DE"),
    days: p.get("period") === "7d" ? 7 : p.get("period") === "90d" ? 90 : 28,
    end: isDate(end) && end <= SNAPSHOT && end >= "2026-07-01" ? end : SNAPSHOT,
    start:
      isDate(p.get("start")) &&
      p.get("start")! >= "2026-04-15" &&
      p.get("start")! <= (isDate(end) && end <= SNAPSHOT ? end : SNAPSHOT)
        ? p.get("start")!
        : "",
    compare: p.get("compare") !== "off",
    selected: (p.get("selected") ?? "k0,k1")
      .split(",")
      .filter((v) => /^k[0-7]$/.test(v))
      .slice(0, 4),
    productTab: pick(
      "tab",
      ["paths", "funnels", "retention", "events"],
      "paths",
    ),
    query: (p.get("q") ?? "").slice(0, 120),
    startEvent: (p.get("startEvent") ?? "").slice(0, 80),
    direction: pick("direction", ["next", "previous"], "next"),
    horizon: [1, 24, 168].includes(Number(p.get("horizon")))
      ? Number(p.get("horizon"))
      : 24,
    steps: [2, 3, 4].includes(Number(p.get("steps")))
      ? Number(p.get("steps"))
      : 3,
    identity: pick("identity", ["install", "session"], "install"),
    state: pick(
      "state",
      ["complete", "partial", "empty", "stale", "failed"],
      "complete",
    ),
    cohort: isDate(p.get("cohort")) ? p.get("cohort")! : "",
    adsLevel: pick(
      "level",
      ["campaign", "group", "keyword", "term"],
      "campaign",
    ),
    attribution: pick("attribution", ["tap", "view", "total"], "tap"),
    funnel: (p.get("funnel") ?? "")
      .split(",")
      .filter((n) => /^[a-z_]{1,60}$/.test(n))
      .slice(0, 12),
    parent: (p.get("parent") ?? "").replace(/[^a-z0-9/\-]/gi, "").slice(0, 80),
  };
}
export function scopeParams(s: SignalScope) {
  return new URLSearchParams({
    app: s.app,
    country: s.country,
    period: s.days + "d",
    end: s.end,
    start: s.start,
    compare: s.compare ? "previous" : "off",
    selected: s.selected.join(","),
    tab: s.productTab,
    q: s.query,
    startEvent: s.startEvent,
    direction: s.direction,
    horizon: String(s.horizon),
    steps: String(s.steps),
    identity: s.identity,
    state: s.state,
    cohort: s.cohort,
    level: s.adsLevel,
    attribution: s.attribution,
    parent: s.parent,
    funnel: s.funnel.join(","),
    data: "sample",
  });
}
export function fixturePreviewAllowed(
  env: { NODE_ENV?: string; KOPA_SIGNAL_FIXTURES?: string },
  requested: boolean,
) {
  return (
    env.NODE_ENV === "development" &&
    env.KOPA_SIGNAL_FIXTURES === "1" &&
    requested
  );
}
export function signalEnabled(env: Record<string, string | undefined>) {
  return env.KOPA_SIGNAL_UI === "1";
}
