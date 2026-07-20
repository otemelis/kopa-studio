// Client copy of api/aso/_lib/calc.js. Duplicated deliberately: this
// project has no bundler, so `api/` (server-only, Vercel functions) and
// `src/` (public static assets) can't share a module without one. Keep
// this in sync with the server copy if the logic ever changes — both are
// mechanical ports of the same source (acros-studio/lib/aso/calc.ts).

export function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

export function rankChange(current, previous) {
  if (current == null || previous == null) return null;
  return previous - current;
}

/** Latest snapshot per (keyword, app) from a snapshot list. */
export function latestSnapshots(snapshots) {
  const map = new Map();
  for (const s of snapshots) {
    const key = `${s.keyword_id}:${s.store_app_id}`;
    const existing = map.get(key);
    if (!existing || existing.captured_at < s.captured_at) map.set(key, s);
  }
  return map;
}

export function sumMetrics(metrics, from, to) {
  let impressions = 0;
  let pageViews = 0;
  let downloads = 0;
  let proceeds = 0;
  let days = 0;
  for (const m of metrics) {
    if (m.date < from || m.date > to) continue;
    days += 1;
    impressions += m.impressions ?? 0;
    pageViews += m.page_views ?? 0;
    downloads += m.downloads ?? 0;
    proceeds += m.proceeds ?? 0;
  }
  return {
    impressions,
    page_views: pageViews,
    downloads,
    proceeds,
    conversion: pageViews > 0 ? downloads / pageViews : null,
    days_with_data: days,
  };
}

export function pctChange(current, previous) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function compareWindows(metrics, windowDays, refDate) {
  const currentFrom = addDays(refDate, -(windowDays - 1));
  const previousTo = addDays(currentFrom, -1);
  const previousFrom = addDays(previousTo, -(windowDays - 1));
  const current = sumMetrics(metrics, currentFrom, refDate);
  const previous = sumMetrics(metrics, previousFrom, previousTo);
  return {
    window_days: windowDays,
    current,
    previous,
    impressions_pct: pctChange(current.impressions, previous.impressions),
    page_views_pct: pctChange(current.page_views, previous.page_views),
    downloads_pct: pctChange(current.downloads, previous.downloads),
    conversion_pp:
      current.conversion != null && previous.conversion != null
        ? (current.conversion - previous.conversion) * 100
        : null,
  };
}

/**
 * Compare `windowDays` before a change date with `windowDays` starting on
 * the change date. The change day itself belongs to "after".
 */
export function prePostComparison(metrics, changeDate, windowDays, minDaysEachSide = Math.ceil(windowDays * 0.7)) {
  const beforeTo = addDays(changeDate, -1);
  const beforeFrom = addDays(beforeTo, -(windowDays - 1));
  const afterFrom = changeDate;
  const afterTo = addDays(changeDate, windowDays - 1);
  const previous = sumMetrics(metrics, beforeFrom, beforeTo);
  const current = sumMetrics(metrics, afterFrom, afterTo);
  return {
    window_days: windowDays,
    current,
    previous,
    impressions_pct: pctChange(current.impressions, previous.impressions),
    page_views_pct: pctChange(current.page_views, previous.page_views),
    downloads_pct: pctChange(current.downloads, previous.downloads),
    conversion_pp:
      current.conversion != null && previous.conversion != null
        ? (current.conversion - previous.conversion) * 100
        : null,
    before_from: beforeFrom,
    before_to: beforeTo,
    after_from: afterFrom,
    after_to: afterTo,
    sufficient: previous.days_with_data >= minDaysEachSide && current.days_with_data >= minDaysEachSide,
  };
}

export function formatPct(value, digits = 0) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatPp(value, digits = 1) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)} pp`;
}

export function formatNumber(value) {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

export function formatRank(rank) {
  return rank == null ? "Not ranked" : `#${rank}`;
}
