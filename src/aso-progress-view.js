import { compareRankWindow, compareRankAroundChange, compareRecentAcquisitionWindows, compareAcquisitionWindows, assessAsoprogress, parseCsv, summarizeSnapshotDownloads } from "./aso-progress.js";

const APP_KEY = "kopa-aso-progress-app-v1";
const COUNTRY_KEY = "kopa-aso-progress-country-v1";
const DAYS_KEY = "kopa-aso-progress-days-v1";
const SOURCE_LABELS = {
  apple_web_search: ["Apple web App Store", "Web result order; unlabeled placements may not be organic."],
  itunes_search: ["iTunes Search API", "Catalog order; not native App Store ranking."],
  public_store: ["iTunes Search API · stored as public_store", "Catalog order; not native App Store ranking."],
};

export async function renderAsoProgress(panel, { pg, formatNumber, addDays, toDateStr, escapeHtml, workspaceAppScope }) {
  const [apps, links, keywords] = await Promise.all([
    pg("aso_apps", "select=id,name,store_app_id&order=name.asc"),
    pg("aso_app_keywords", "select=id,app_id,keyword_id,status,priority&order=priority.asc"),
    pg("aso_keywords", "select=id,term,country,language"),
  ]);
  if (!apps.length) {
    panel.innerHTML = '<section class="panel"><h3>No apps tracked</h3><p class="empty-state">Add an app and a small set of country-specific keywords to begin.</p></section>';
    return;
  }
  const savedApp = localStorage.getItem(APP_KEY);
  const app = apps.find((row) => row.id === savedApp)
    ?? (workspaceAppScope !== "all" ? apps.find((row) => row.id === workspaceAppScope) : null)
    ?? apps.find((row) => /innertype/i.test(row.name)) ?? apps[0];
  const appLinks = links.filter((link) => link.app_id === app.id && link.status !== "paused");
  const tracked = appLinks.map((link) => ({ link, keyword: keywords.find((row) => row.id === link.keyword_id) })).filter((row) => row.keyword);
  const countries = [...new Set(tracked.map(({ keyword }) => keyword.country))].sort();
  const requestedCountry = localStorage.getItem(COUNTRY_KEY) ?? "us";
  const country = countries.includes(requestedCountry) ? requestedCountry : countries.includes("us") ? "us" : countries[0] ?? "us";
  const selected = tracked.filter(({ keyword }) => keyword.country === country);
  const keywordIds = selected.map(({ keyword }) => keyword.id);
  const days = Number(localStorage.getItem(DAYS_KEY) ?? 28) === 7 ? 7 : 28;
  const today = toDateStr(new Date());
  const from = addDays(today, -150);
  const idsFilter = `in.(${keywordIds.join(",") || "00000000-0000-0000-0000-000000000000"})`;
  const [snapshots, searchRows, salesRows, changes, adsRows] = await Promise.all([
    keywordIds.length ? pg("aso_keyword_rank_snapshots", `app_kind=eq.owned&store_app_id=eq.${encodeURIComponent(app.store_app_id)}&keyword_id=${encodeURIComponent(idsFilter)}&captured_at=gte.${from}T00:00:00Z&select=keyword_id,captured_at,captured_on,rank,found,result_depth,collection_status,source&order=captured_at.asc&limit=5000`) : Promise.resolve([]),
    pg("aso_storefront_metrics", `app_id=eq.${app.id}&country=eq.${country}&date=gte.${from}&event=in.(Impression,Page view)&source_type=eq.App Store search&select=date,country,event,source_type,count,unique_count,source&order=date.asc&limit=1000`),
    pg("aso_daily_metrics", `app_id=eq.${app.id}&country=eq.${country}&source=eq.appstore_connect_sales&date=gte.${from}&select=date,downloads,source&order=date.asc&limit=500`),
    pg("aso_metadata_change_events", `app_id=eq.${app.id}&select=id,happened_at,country,locale,change_type,field,old_value,new_value,origin,source,note&order=happened_at.desc&limit=30`),
    pg("apple_ads_daily_metrics", `app_id=eq.${app.id}&country=eq.${country}&metric_date=gte.${from}&select=metric_date,impressions,taps,installs,new_downloads,spend,currency&order=metric_date.asc&limit=500`).catch(() => null),
  ]);
  let snapshotRows = [];
  let snapshotAvailable = false;
  try {
    const response = await fetch("/reporting/portfolio/daily-acquisition-monetization.csv", { cache: "no-store" });
    if (response.ok) {
      snapshotRows = parseCsv(await response.text()).map((row) => ({ ...row, date: row.date || row["\uFEFFdate"] }));
      snapshotAvailable = true;
    }
  } catch { /* Keep the official snapshot explicitly unavailable if the static report cannot be loaded. */ }
  const downloadRows = snapshotRows.filter((row) => row.app === app.name && row.metric === "first_time_downloads" && row.scope === "summary" && row.acquisition_source === "All sources");
  const latestDownloadDate = downloadRows.filter((row) => ["reported_value", "zero_no_rows_in_validated_standard_extract"].includes(row.data_quality_status)).reduce((latest, row) => row.date > latest ? row.date : latest, "");
  const snapshotExtractedAt = downloadRows.reduce((latest, row) => String(row.source_extracted_at_utc ?? "") > latest ? String(row.source_extracted_at_utc ?? "") : latest, "");
  const paidRowsUnavailable = adsRows === null;
  const allPaidRows = adsRows ?? [];

  const sources = [...new Set(["apple_web_search", "public_store", ...snapshots.map((row) => row.source || "unknown")])].sort((a, b) => {
    const order = ["apple_web_search", "public_store"];
    return (order.indexOf(a) < 0 ? 9 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 9 : order.indexOf(b));
  });
  const sortedChanges = [...changes].sort((a, b) => String(b.happened_at).localeCompare(String(a.happened_at)));
  const savedChange = localStorage.getItem("kopa-aso-progress-change-v1");
  const selectedChange = sortedChanges.find((row) => row.id === savedChange) ?? null;
  const grouped = new Map(sources.map((source) => [source, selected.map(({ keyword }) => {
    const series = snapshots.filter((row) => row.keyword_id === keyword.id && (row.source || "unknown") === source);
    return { keyword, ...(selectedChange ? compareRankAroundChange(series, selectedChange.happened_at.slice(0, 10), days) : compareRankWindow(series, days)) };
  })]));
  const latestSearchDate = searchRows.reduce((latest, row) => row.date > latest ? row.date : latest, "");
  const latestSnapshotDate = snapshots.reduce((latest, row) => row.captured_on > latest ? row.captured_on : latest, "");
  const asOf = snapshotAvailable && latestDownloadDate
    ? [latestSearchDate, latestDownloadDate].filter(Boolean).sort()[0] || latestSnapshotDate || today
    : latestSearchDate || latestSnapshotDate || today;
  const acquisition = selectedChange
    ? compareAcquisitionWindows(searchRows, selectedChange.happened_at.slice(0, 10), days, { country })
    : compareRecentAcquisitionWindows(searchRows, asOf, days, { country });
  const fmt = (value) => value.available ? formatNumber(value.value) : "Unavailable";
  const metricCoverage = (value) => value.available ? `${value.days}/${value.expectedDays} dates` : "no reported dates";
  const downloadAnchor = selectedChange ? selectedChange.happened_at.slice(0, 10) : asOf;
  const downloadAfterStart = latestDownloadDate ? (selectedChange ? addDays(downloadAnchor, 1) : addDays(downloadAnchor, -(days - 1))) : "";
  const downloadAfterEnd = latestDownloadDate ? (selectedChange ? addDays(downloadAnchor, days) : downloadAnchor) : "";
  const downloadBeforeEnd = downloadAfterStart ? (selectedChange ? addDays(downloadAnchor, -1) : addDays(downloadAfterStart, -1)) : "";
  const downloadBeforeStart = downloadBeforeEnd ? (selectedChange ? addDays(downloadAnchor, -days) : addDays(downloadBeforeEnd, -(days - 1))) : "";
  const downloadComparison = latestDownloadDate ? {
    before: summarizeSnapshotDownloads(snapshotRows, { app: app.name, start: downloadBeforeStart, end: downloadBeforeEnd }),
    after: summarizeSnapshotDownloads(snapshotRows, { app: app.name, start: downloadAfterStart, end: downloadAfterEnd }),
  } : null;
  const searchDownloadComparison = latestDownloadDate ? {
    before: summarizeSnapshotDownloads(snapshotRows, { app: app.name, start: downloadBeforeStart, end: downloadBeforeEnd, acquisitionSource: "App Store search" }),
    after: summarizeSnapshotDownloads(snapshotRows, { app: app.name, start: downloadAfterStart, end: downloadAfterEnd, acquisitionSource: "App Store search" }),
  } : null;
  const completeDownloadWindow = (value) => Boolean(value?.available && value.days === value.expectedDays);
  const downloadDelta = completeDownloadWindow(downloadComparison?.before) && completeDownloadWindow(downloadComparison?.after)
    ? downloadComparison.after.value - downloadComparison.before.value : null;
  const downloadCompleteness = (value) => value.available ? `${value.days}/${value.expectedDays} reported days` : "no validated rows";
  const searchDownloadLabel = searchDownloadComparison?.after.available
    ? `App Store Search first-time downloads: ${formatNumber(searchDownloadComparison.after.value)} (${downloadCompleteness(searchDownloadComparison.after)})${completeDownloadWindow(searchDownloadComparison.before) && completeDownloadWindow(searchDownloadComparison.after) ? ` vs ${formatNumber(searchDownloadComparison.before.value)} prior (${downloadCompleteness(searchDownloadComparison.before)})` : "; prior period unavailable or incomplete"}.`
    : "App Store Search first-time download breakdown unavailable.";
  const sourceCards = sources.map((source) => {
    const movement = grouped.get(source) ?? [];
    const assessment = assessAsoprogress(movement, acquisition, downloadComparison);
    const valid = movement.filter((item) => item.state === "comparable");
    const up = valid.filter((item) => item.delta > 0).length;
    const down = valid.filter((item) => item.delta < 0).length;
    const flat = valid.filter((item) => item.delta === 0).length;
    const [label, note] = SOURCE_LABELS[source] ?? [source.replaceAll("_", " "), "Source-specific ordering; interpret within this source only."];
    return `<article class="aso-progress-source"><div><span>${escapeHtml(label)}</span><strong class="status-${assessment.status.replaceAll(" ", "-")}">${escapeHtml(assessment.status)}</strong></div><p>${escapeHtml(assessment.explanation)}</p><small>${up} up · ${down} down · ${flat} unchanged of ${valid.length} comparable terms. ${escapeHtml(note)}</small></article>`;
  }).join("");

  const sourceCell = (item) => {
    if (!item.current) return '<span class="muted">No observations</span>';
    if (item.state === "not_observed") return `<strong>Not observed</strong><small>within ${item.current.result_depth} displayed results</small><small>${dateLabel(item.current.captured_at)} · not proof of unranked</small>`;
    if (item.state === "comparable") {
      const shift = item.delta > 0 ? `↑ ${item.delta}` : item.delta < 0 ? `↓ ${Math.abs(item.delta)}` : "No change";
      const cls = item.delta > 0 ? "up" : item.delta < 0 ? "down" : "muted";
      return `<strong>${item.current.rank == null ? "—" : `#${item.current.rank}`}</strong><small class="${cls}">${shift} · #${item.previous.rank} (${dateLabel(item.previous.captured_at)} → ${dateLabel(item.current.captured_at)})</small><small>Selected ${days}d window · depth ${item.current.result_depth}</small>`;
    }
    return `<strong>${item.current.found && item.current.rank != null ? `#${item.current.rank}` : "Not observed"}</strong><small>${item.current.found ? "Need an earlier comparable snapshot" : `within ${item.current.result_depth} displayed results`}</small><small>${dateLabel(item.current.captured_at)} · depth ${item.current.result_depth}</small>`;
  };
  const headers = sources.map((source) => `<th>${escapeHtml(SOURCE_LABELS[source]?.[0] ?? source.replaceAll("_", " "))}</th>`).join("");
  const termRows = selected.map(({ link, keyword }) => `<tr><th scope="row"><strong>${escapeHtml(keyword.term)}</strong><small>${escapeHtml(link.priority)} priority</small></th>${sources.map((source) => `<td class="aso-progress-rank">${sourceCell(grouped.get(source).find((row) => row.keyword.id === keyword.id))}</td>`).join("") || '<td><span class="muted">No observations</span></td>'}</tr>`).join("");
  const metricChart = chartHtml(searchRows, selectedChange ? acquisition.after.end : asOf, days, addDays, escapeHtml);
  const priorImpressions = acquisition.before.impressions;
  const currentImpressions = acquisition.after.impressions;
  const impressionsDelta = priorImpressions.available && currentImpressions.available && priorImpressions.days === priorImpressions.expectedDays && currentImpressions.days === currentImpressions.expectedDays
    ? currentImpressions.value - priorImpressions.value : null;
  const salesStart = acquisition.after.start;
  const salesEnd = acquisition.after.end;
  const safeAdsRows = allPaidRows.filter((row) => row.metric_date >= salesStart && row.metric_date <= salesEnd);
  const units = salesRows.filter((row) => row.date >= salesStart && row.date <= salesEnd && row.downloads != null);
  const unitsValue = units.reduce((sum, row) => sum + Number(row.downloads), 0);
  const changeRows = sortedChanges.slice(0, 8).map((row) => `<li><time>${dateLabel(row.happened_at)}</time><strong>${escapeHtml(row.field || row.change_type)}</strong><span>${escapeHtml(row.origin)} · ${escapeHtml(row.source)}</span><small>${escapeHtml(row.note || changeBrief(row))}</small></li>`).join("") || '<li class="empty-state">No metadata changes are recorded for this app.</li>';
  const paidImpressions = safeAdsRows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
  const paidSpend = safeAdsRows.reduce((sum, row) => sum + Number(row.spend ?? 0), 0);

  panel.innerHTML = `
    <section class="panel aso-progress-intro"><div class="panel-head"><div><h3>ASO progress</h3><p>Did visibility and App Store Search acquisition move after listing changes?</p></div><span class="aso-progress-stamp">Shared comparison through ${escapeHtml(asOf)} · Search through ${escapeHtml(latestSearchDate || "unavailable")} · downloads through ${escapeHtml(latestDownloadDate || "unavailable")} · ${days}-day periods</span></div>
      <div class="aso-progress-controls"><label>App<select id="aso-progress-app">${apps.map((row) => `<option value="${row.id}" ${row.id === app.id ? "selected" : ""}>${escapeHtml(row.name)}</option>`).join("")}</select></label><label>Country<select id="aso-progress-country">${countries.map((code) => `<option value="${escapeHtml(code)}" ${code === country ? "selected" : ""}>${escapeHtml(code.toUpperCase())}</option>`).join("")}</select></label><label>Window<select id="aso-progress-days"><option value="7" ${days === 7 ? "selected" : ""}>7 days</option><option value="28" ${days === 28 ? "selected" : ""}>28 days</option></select></label><label>Compare around<select id="aso-progress-change"><option value="recent">Recent periods</option>${sortedChanges.map((row) => `<option value="${row.id}" ${selectedChange?.id === row.id ? "selected" : ""}>${escapeHtml(dateLabel(row.happened_at))} · ${escapeHtml(row.field || row.change_type)}</option>`).join("")}</select></label></div>
      <p class="aso-progress-caveat">${selectedChange ? `Comparing ${days} days before and after the ${escapeHtml(selectedChange.field || selectedChange.change_type)} change on ${escapeHtml(dateLabel(selectedChange.happened_at))}. This is descriptive, not proof of causation.` : `Comparing source windows ending on the shared date ${escapeHtml(asOf)}. This is descriptive, not proof of causation.`} Ranking sources remain separate. App Store Search source counts may include paid placement; missing ASC dates are not converted to zero. Incomplete impression coverage cannot produce an improving/declining assessment.</p>
    </section>
    <div class="mini-stat-grid aso-progress-metrics"><article><span>App Store Search impressions</span><strong>${fmt(acquisition.after.impressions)}</strong><small>${escapeHtml(acquisition.after.start)}–${escapeHtml(acquisition.after.end)} · ${metricCoverage(currentImpressions)} · ${impressionsDelta == null ? "no complete comparable prior total" : `${impressionsDelta > 0 ? "+" : ""}${formatNumber(impressionsDelta)} vs prior window`}</small></article><article><span>Search product-page views</span><strong>${fmt(acquisition.after.pageViews)}</strong><small>${escapeHtml(acquisition.after.start)}–${escapeHtml(acquisition.after.end)} · ${metricCoverage(acquisition.after.pageViews)} · missing dates are not zero</small></article><article><span>First-time downloads · all storefronts</span><strong>${downloadComparison?.after.available ? formatNumber(downloadComparison.after.value) : "Unavailable"}</strong><small>${downloadComparison?.after.available ? `${escapeHtml(downloadAfterStart)}–${escapeHtml(downloadAfterEnd)} · ${downloadCompleteness(downloadComparison.after)} · ${downloadDelta == null ? "prior period unavailable or incomplete" : `${downloadDelta > 0 ? "+" : ""}${formatNumber(downloadDelta)} vs prior ${days} days`}` : "Validated daily ASC snapshot is unavailable for this period."}</small><small>${snapshotExtractedAt ? `ASC snapshot extracted ${escapeHtml(snapshotExtractedAt.slice(0, 10))}; all-storefront scope.` : "Official ASC daily report snapshot; separate all-storefront scope."} ${escapeHtml(searchDownloadLabel)}</small></article><article><span>Sales report units</span><strong>${units.length ? formatNumber(unitsValue) : "Unavailable"}</strong><small>${units.length ? `${escapeHtml(salesStart)}–${escapeHtml(salesEnd)} · units, not first-time-only` : "No units reported for this period"}</small></article></div>
    <section class="panel"><div class="panel-head"><div><h3>App Store Search trend</h3><p>Reported daily event counts, not unique people; blank dates are gaps, not zeros.</p></div><span>${escapeHtml(acquisition.before.start)}–${escapeHtml(acquisition.after.end)}</span></div><div class="aso-progress-compare"><div><span>Impressions</span><strong>${fmt(acquisition.before.impressions)} <i>→</i> ${fmt(acquisition.after.impressions)}</strong><small>${metricCoverage(acquisition.before.impressions)} → ${metricCoverage(acquisition.after.impressions)}</small></div><div><span>Page views</span><strong>${fmt(acquisition.before.pageViews)} <i>→</i> ${fmt(acquisition.after.pageViews)}</strong><small>${metricCoverage(acquisition.before.pageViews)} → ${metricCoverage(acquisition.after.pageViews)}</small></div></div><div class="aso-progress-chart"><div class="aso-progress-chart-legend"><span><i class="impressions"></i>Impressions</span><span><i class="views"></i>Page views</span></div>${metricChart}</div></section>
    <section class="panel"><div class="panel-head"><div><h3>First-time downloads</h3><p>Official App Store Connect daily snapshot, all storefronts; not installs or first opens. Missing dates remain gaps.</p></div><span>${downloadComparison?.after.available ? `${escapeHtml(downloadAfterStart)}–${escapeHtml(downloadAfterEnd)}` : "Unavailable"}</span></div>${downloadComparison?.after.available ? downloadChartHtml(snapshotRows, app.name, downloadAfterEnd, days, addDays, escapeHtml) : '<p class="empty-state">No validated first-time download rows are available in the selected report snapshot.</p>'}</section>
    <section class="panel"><div class="panel-head"><div><h3>Keyword movement</h3><p>${selectedChange ? "Latest observations inside the selected before/after periods." : `Latest source observation vs the nearest sample around ${days} days earlier.`}</p></div><span>${selected.length} tracked terms · ${country.toUpperCase()}</span></div>${snapshots.length ? `<div class="aso-progress-assessments">${sourceCards}</div>` : '<p class="empty-state">No ranking snapshots are stored for this country in the selected window yet. Apple web and iTunes series remain separate.</p>'}<div class="aso-progress-table-wrap"><table class="aso-table aso-progress-table"><thead><tr><th>Keyword</th>${headers || '<th>Source observation</th>'}</tr></thead><tbody>${termRows || `<tr><td colspan="${sources.length + 1}" class="empty-state">No active keywords configured for ${country.toUpperCase()}.</td></tr>`}</tbody></table></div></section>
    <div class="aso-progress-bottom"><section class="panel"><div class="panel-head"><div><h3>Metadata changes</h3><p>Detected changes are context for later movement; they do not prove causation.</p></div></div><ol class="aso-progress-timeline">${changeRows}</ol></section><section class="panel"><div class="panel-head"><div><h3>Paid-search context</h3><p>Apple Ads stays separate from organic visibility.</p></div></div>${paidRowsUnavailable ? '<p class="empty-state">Apple Ads data is unavailable in this session.</p>' : safeAdsRows.length ? `<div class="aso-progress-paid"><strong>${formatNumber(paidImpressions)} paid impressions</strong><span>Spend ${formatNumber(paidSpend)} ${escapeHtml(safeAdsRows[0].currency ?? "currency unavailable")}</span><small>Spend and attribution are limited to the selected comparison period.</small></div>` : '<p class="empty-state">No Apple Ads rows are stored for the selected country and comparison period. App Store Search cannot be split into organic and paid impressions with current records.</p>'}<p class="aso-progress-method">Apple web snapshots exclude only explicitly labeled ads; unlabeled placements stay uncertain. iTunes Search catalog positions are not native organic rankings. Rankings are never filled or blended across sources.</p></section></div>`;

  panel.querySelector("#aso-progress-app")?.addEventListener("change", (event) => { localStorage.setItem(APP_KEY, event.target.value); renderAsoProgress(panel, { pg, formatNumber, addDays, toDateStr, escapeHtml, workspaceAppScope }); });
  panel.querySelector("#aso-progress-country")?.addEventListener("change", (event) => { localStorage.setItem(COUNTRY_KEY, event.target.value); renderAsoProgress(panel, { pg, formatNumber, addDays, toDateStr, escapeHtml, workspaceAppScope }); });
  panel.querySelector("#aso-progress-days")?.addEventListener("change", (event) => { localStorage.setItem(DAYS_KEY, event.target.value); renderAsoProgress(panel, { pg, formatNumber, addDays, toDateStr, escapeHtml, workspaceAppScope }); });
  panel.querySelector("#aso-progress-change")?.addEventListener("change", (event) => { if (event.target.value === "recent") localStorage.removeItem("kopa-aso-progress-change-v1"); else localStorage.setItem("kopa-aso-progress-change-v1", event.target.value); renderAsoProgress(panel, { pg, formatNumber, addDays, toDateStr, escapeHtml, workspaceAppScope }); });
}

function dateLabel(value) {
  const date = String(value ?? "").slice(0, 10);
  return date ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "—";
}

function changeBrief(row) {
  const oldValue = String(row.old_value ?? "").replace(/\s+/g, " ").slice(0, 52);
  const newValue = String(row.new_value ?? "").replace(/\s+/g, " ").slice(0, 52);
  return oldValue || newValue ? `${oldValue || "No prior value"} → ${newValue || "Removed"}` : "No change details recorded";
}

function chartHtml(rows, end, days, addDays, escapeHtml) {
  const start = addDays(end, -(days - 1));
  const dates = Array.from({ length: days }, (_, index) => addDays(start, index));
  const byDate = new Map();
  for (const row of rows.filter((item) => item.date >= start && item.date <= end)) {
    if (!byDate.has(row.date)) byDate.set(row.date, { impressions: null, views: null });
    const key = row.event === "Impression" ? "impressions" : row.event === "Page view" ? "views" : null;
    if (key) byDate.get(row.date)[key] = (byDate.get(row.date)[key] ?? 0) + Number(row.count ?? 0);
  }
  const max = Math.max(1, ...[...byDate.values()].flatMap((value) => [value.impressions, value.views]).filter((value) => value != null));
  const bars = dates.map((date) => {
    const value = byDate.get(date);
    if (!value) return `<div class="aso-progress-day missing" title="${date}: no row reported"><span></span><span></span></div>`;
    const bar = (metric, label, cls) => value[metric] == null ? `<span class="missing-bar ${cls}" title="${date}: no ${label} row reported"></span>` : `<span class="${cls}" style="--bar-height:${value[metric] === 0 ? 0 : Math.max(3, value[metric] / max * 100)}%" title="${date}: ${label} ${value[metric]}"></span>`;
    return `<div class="aso-progress-day">${bar("impressions", "impressions", "impressions")}${bar("views", "page views", "views")}</div>`;
  }).join("");
  return `<div class="aso-progress-bar-grid" style="--bar-days:${days}">${bars}</div><div class="aso-progress-chart-dates"><span>${escapeHtml(start)}</span><span>${escapeHtml(end)}</span></div>`;
}

function downloadChartHtml(rows, app, end, days, addDays, escapeHtml) {
  const start = addDays(end, -(days - 1));
  const usable = new Set(["reported_value", "zero_no_rows_in_validated_standard_extract"]);
  const byDate = new Map(rows.filter((row) => row.app === app && row.metric === "first_time_downloads" && row.scope === "summary" && row.acquisition_source === "All sources" && row.date >= start && row.date <= end && usable.has(row.data_quality_status)).map((row) => [row.date, Number(row.value)]));
  const max = Math.max(1, ...byDate.values());
  const bars = Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    if (!byDate.has(date)) return `<div class="aso-progress-day missing" title="${date}: no validated row"><span></span></div>`;
    const value = byDate.get(date);
    return `<div class="aso-progress-day"><span class="downloads" style="--bar-height:${value === 0 ? 0 : Math.max(3, value / max * 100)}%" title="${date}: ${value}"></span></div>`;
  }).join("");
  return `<div class="aso-progress-chart aso-progress-download-chart"><div class="aso-progress-chart-legend"><span><i class="downloads"></i>First-time downloads</span></div><div class="aso-progress-bar-grid" style="--bar-days:${days}">${bars}</div><div class="aso-progress-chart-dates"><span>${escapeHtml(start)}</span><span>${escapeHtml(end)}</span></div></div>`;
}
