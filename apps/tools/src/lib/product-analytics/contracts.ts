/** Actual legacy telemetry. Never interpret an anonymous UUID as a verified person. */
export type ProductEvent = {
  id: string;
  app: string;
  environment: string;
  name: string;
  anonymousId: string;
  sessionId: string;
  time: string;
  received: string;
  country: string;
  version: string;
  platform: string;
  osVersion: string;
  properties: Record<string, unknown>;
};
export type CatalogEntry = { name: string; required: string[] };
export type SourceManifest = {
  project: string;
  app: string;
  cutoff: string;
  tables: { events: { rows: number; sha256: string } };
  verifiedStableRead: boolean;
};
export type ProductScope = {
  app: string;
  start: string;
  end: string;
  country: string;
  version: string;
  language: string;
  source: string;
  assessment: string;
  funnel: "assessment" | "purchase";
  journey: "assessment_started" | "app_opened" | "paywall_viewed";
  tab: "journeys" | "funnels" | "retention" | "events" | "quality";
  query: string;
};
export const HORIZON_MS = 24 * 60 * 60 * 1000;
const DAY = HORIZON_MS;
export const day = (iso: string) => iso.slice(0, 10);
export const offsetDay = (value: string, days: number) =>
  new Date(Date.parse(value + "T00:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
export function dateWindow(scope: ProductScope) {
  const start = Date.parse(scope.start + "T00:00:00Z");
  const end = Date.parse(scope.end + "T00:00:00Z") + DAY;
  return {
    start,
    end,
    previousStart: start - (end - start),
    previousEnd: start,
  };
}
const validDay = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
  day(new Date(s + "T00:00:00Z").toISOString()) === s;
const text = (p: URLSearchParams, key: string) =>
  (p.get(key) || "ALL").slice(0, 80);
export function parseProductScope(
  p: URLSearchParams,
  cutoff: string,
): ProductScope {
  const endDefault = offsetDay(day(cutoff), -1); // last fully elapsed UTC day, not a completeness guarantee
  const start = p.get("start") || offsetDay(endDefault, -27);
  const end = p.get("end") || endDefault;
  if (
    !validDay(start) ||
    !validDay(end) ||
    end < start ||
    Date.parse(end) - Date.parse(start) > 365 * DAY
  )
    throw new Error("Choose an ordered UTC date range of at most 366 days.");
  if (end > day(cutoff))
    throw new Error("The selected end date is after the source snapshot.");
  const tab = p.get("tab");
  return {
    app: p.get("app") || "innertype",
    start,
    end,
    country: text(p, "country"),
    version: text(p, "version"),
    language: text(p, "language"),
    source: text(p, "source"),
    assessment: text(p, "assessment"),
    funnel: p.get("funnel") === "purchase" ? "purchase" : "assessment",
    journey:
      p.get("journey") === "app_opened"
        ? "app_opened"
        : p.get("journey") === "paywall_viewed"
          ? "paywall_viewed"
          : "assessment_started",
    tab:
      tab === "funnels" ||
      tab === "retention" ||
      tab === "events" ||
      tab === "quality"
        ? tab
        : "journeys",
    query: (p.get("q") || "").slice(0, 80),
  };
}
export function localSnapshotEnabled(env: Record<string, string | undefined>) {
  return (
    env.NODE_ENV === "development" &&
    env.KOPA_SIGNAL_UI === "1" &&
    env.KOPA_SIGNAL_LOCAL_READONLY === "1"
  );
}
/** Reject alternate Host names (including rebinding) and cross-origin browser reads. */
export function localRequestAllowed(
  host: string | null,
  origin: string | null,
) {
  if (!host || !/^(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(host))
    return false;
  return !origin || origin === "http://" + host;
}
