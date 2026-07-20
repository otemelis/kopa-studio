// Kopa ASO Intelligence — client console tab. Loaded alongside main.js;
// deliberately loosely coupled to it (reads the same localStorage session
// key main.js already writes on sign-in, rather than importing its mutable
// state) so this file can't break the existing Analytics tab.
//
// Same architecture as the rest of the console: fetch raw rows from
// Supabase PostgREST with the signed-in admin's access token (RLS-gated by
// analytics_admins — see supabase/aso-security.sql), compute and render as
// template strings. No client bundler, so the shared calc helpers live in
// aso-calc.js as a plain duplicate of api/aso/_lib/calc.js.

import {
  addDays,
  compareWindows,
  formatNumber,
  formatPct,
  formatPp,
  formatRank,
  latestSnapshots,
  evaluateExperimentOutcome,
  prePostComparison,
  rankChange,
  toDateStr,
} from "./aso-calc.js";

const SESSION_KEY = "kopa-admin-session-v1";
const KEYWORD_VIEWS_KEY = "kopa-aso-keyword-views-v1";
const WORKSPACE_APP_SCOPE_KEY = "kopa-aso-workspace-app-v1";
let runtimeConfig = null;
let activeSubTab = "briefing";
let editingKeywordLinkId = null;
let keywordFormOpen = false;
let keywordFilters = { query: "", app: "all", country: "all", priority: "all", movement: "all", sort: "priority" };
let selectedKeywordLinkIds = new Set();
let workspaceAppScope = localStorage.getItem(WORKSPACE_APP_SCOPE_KEY) ?? "all";
let portfolioSort = "insights";
let insightFilters = { app: "all", priority: "important", source: "all" };
let competitorFilters = { app: "all", change: "all" };
let reviewFilters = { app: "all", rating: "all", country: "all", topic: "all" };

function getSavedKeywordViews() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEYWORD_VIEWS_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveKeywordViews(views) {
  localStorage.setItem(KEYWORD_VIEWS_KEY, JSON.stringify(views));
}

function getSession() {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

async function config() {
  if (runtimeConfig) return runtimeConfig;
  const local = window.KOPA_CONFIG || {};
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    if (res.ok) {
      runtimeConfig = { ...local, ...(await res.json()) };
      return runtimeConfig;
    }
  } catch {
    // fall through to local defaults
  }
  runtimeConfig = local;
  return runtimeConfig;
}

/**
 * Supabase access tokens expire (default ~1h) and this hand-rolled console
 * has no background refresh loop, unlike the official supabase-js client.
 * Every request goes through here so a 401 triggers exactly one silent
 * refresh-token exchange + retry before surfacing an error — the user
 * should only ever see "sign out and sign in again" if the refresh token
 * itself is gone (revoked, or genuinely logged out elsewhere).
 */
async function refreshSession() {
  const cfg = await config();
  const session = getSession();
  if (!session?.refresh_token) {
    localStorage.removeItem(SESSION_KEY);
    throw new Error("Session expired — sign out and sign in again.");
  }
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    localStorage.removeItem(SESSION_KEY);
    throw new Error("Session expired — sign out and sign in again.");
  }
  const data = await res.json();
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  return data;
}

async function withAuthRetry(requestFn) {
  const cfg = await config();
  let session = getSession();
  if (!session?.access_token) throw new Error("Not signed in.");
  let res = await requestFn(cfg, session.access_token);
  if (res.status === 401) {
    session = await refreshSession();
    res = await requestFn(cfg, session.access_token);
  }
  return res;
}

async function pg(table, query) {
  const res = await withAuthRetry((cfg, token) =>
    fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${query}`, {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}` },
    }),
  );
  if (!res.ok) throw new Error(`Supabase ${res.status} reading ${table}`);
  return res.json();
}

async function pgWrite(method, table, body, query = "") {
  const res = await withAuthRetry((cfg, token) =>
    fetch(`${cfg.supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ""}`, {
      method,
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body == null ? undefined : JSON.stringify(body),
    }),
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || detail.hint || `Supabase ${res.status} writing ${table}`);
  }
  return res.json();
}

/** Idempotent write via PostgREST upsert (Prefer: resolution=merge-duplicates). */
async function pgUpsert(table, body, onConflict) {
  const res = await withAuthRetry((cfg, token) =>
    fetch(`${cfg.supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(body),
    }),
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || detail.hint || `Supabase ${res.status} writing ${table}`);
  }
  return res.json();
}

async function callApi(path, body) {
  const res = await withAuthRetry((cfg, token) =>
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    }),
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── Shell ────────────────────────────────────────────────────────────────

const SUB_TABS = [
  ["portfolio", "Portfolio"],
  ["briefing", "Briefing"],
  ["keywords", "Keywords"],
  ["insights", "Insights"],
  ["experiments", "Experiments"],
  ["competitors", "Competitors"],
  ["reviews", "Reviews"],
  ["sync", "Sync"],
];

const COUNTRY_ALIASES = {
  ko: ["kr", "Korean is a language code. South Korea's App Store storefront is KR."],
  ja: ["jp", "Japanese is a language code. Japan's App Store storefront is JP."],
  zh: ["tw", "Chinese is a language code. Use TW, HK, MO, or CN for the storefront."],
  uk: ["gb", "Use GB for the United Kingdom App Store storefront."],
};

function normalizeCountry(input) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return { country: "us", warning: null };
  if (!/^[a-z]{2}$/.test(raw)) throw new Error("Country must be a two-letter App Store storefront code, like us, se, tw, hk, kr, or cn.");
  const alias = COUNTRY_ALIASES[raw];
  if (!alias) return { country: raw, warning: null };
  return { country: alias[0], warning: alias[1] };
}

export function mountAsoTab(root) {
  root.innerHTML = `
    <nav class="aso-subnav">
      ${SUB_TABS.map(([id, label]) => `<button type="button" data-aso-tab="${id}" class="${id === activeSubTab ? "active" : ""}">${label}</button>`).join("")}
      <button type="button" class="aso-add-app" data-aso-add-app>+ Add app</button>
    </nav>
    <div id="aso-working-context" class="aso-working-context"><span>Loading workspace context…</span></div>
    <div id="aso-panel" class="aso-panel"><p class="loading-state">Loading…</p></div>
  `;
  root.querySelectorAll("[data-aso-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeSubTab = btn.dataset.asoTab;
      root.querySelectorAll("[data-aso-tab]").forEach((b) => b.classList.toggle("active", b === btn));
      renderSubTab(root.querySelector("#aso-panel"));
    }),
  );
  root.querySelector("[data-aso-add-app]").addEventListener("click", () => renderAddAppForm(root.querySelector("#aso-panel")));
  renderWorkingContext(root);
  renderSubTab(root.querySelector("#aso-panel"));
}

async function renderWorkingContext(root) {
  const context = root.querySelector("#aso-working-context");
  if (!context) return;
  try {
    const [apps, health] = await Promise.all([pg("aso_apps", "select=id,name&order=name.asc"), getCollectionHealth()]);
    if (workspaceAppScope !== "all" && !apps.some((app) => app.id === workspaceAppScope)) workspaceAppScope = "all";
    context.innerHTML = `<div><span>Working context</span><select id="aso-working-app"><option value="all">All apps</option>${apps.map((app) => `<option value="${app.id}" ${workspaceAppScope === app.id ? "selected" : ""}>${escapeHtml(app.name)}</option>`).join("")}</select></div><div class="aso-working-health ${health.isFresh ? "ready" : "attention"}"><span>Collection</span><strong>${health.isFresh ? `${health.freshLinks.length}/${health.activeLinks.length} current` : `${health.staleCount} needs refresh`}</strong></div>`;
    context.querySelector("#aso-working-app")?.addEventListener("change", (event) => {
      workspaceAppScope = event.target.value;
      localStorage.setItem(WORKSPACE_APP_SCOPE_KEY, workspaceAppScope);
      keywordFilters.app = workspaceAppScope;
      insightFilters.app = workspaceAppScope;
      competitorFilters.app = workspaceAppScope;
      reviewFilters.app = workspaceAppScope;
      experimentFilters.app = workspaceAppScope;
      selectedKeywordLinkIds.clear();
      renderSubTab(root.querySelector("#aso-panel"));
    });
  } catch {
    context.innerHTML = '<span>Working context unavailable</span>';
  }
}

async function renderSubTab(panel) {
  panel.innerHTML = '<p class="loading-state">Loading…</p>';
  try {
    if (activeSubTab === "portfolio") await renderPortfolio(panel);
    else if (activeSubTab === "briefing") await renderBriefing(panel);
    else if (activeSubTab === "keywords") await renderKeywords(panel);
    else if (activeSubTab === "insights") await renderInsights(panel);
    else if (activeSubTab === "experiments") await renderExperiments(panel);
    else if (activeSubTab === "competitors") await renderCompetitors(panel);
    else if (activeSubTab === "reviews") await renderReviews(panel);
    else if (activeSubTab === "sync") await renderSync(panel);
    if (!["briefing", "sync"].includes(activeSubTab)) await addFreshnessContext(panel);
  } catch (error) {
    panel.innerHTML = `<section class="panel"><h3>Could not load this view</h3><p class="empty-state">${escapeHtml(error.message)}</p></section>`;
  }
}

async function getCollectionHealth() {
  const today = toDateStr(new Date());
  const [runs, apps, appKeywords, snapshots] = await Promise.all([
    pg("aso_sync_runs", "select=status,started_at,trigger&order=started_at.desc&limit=5"),
    pg("aso_apps", "select=id,store_app_id"),
    pg("aso_app_keywords", "select=app_id,keyword_id,status"),
    pg("aso_keyword_rank_snapshots", `app_kind=eq.owned&captured_on=gte.${addDays(today, -2)}&select=keyword_id,store_app_id`),
  ]);
  const latestRun = runs[0] ?? null;
  const lastOk = runs.find((run) => run.status === "ok" || run.status === "partial");
  const lastOkAge = lastOk ? Date.now() - new Date(lastOk.started_at).getTime() : Infinity;
  const activeLinks = appKeywords.filter((link) => link.status !== "paused");
  const freshLinks = activeLinks.filter((link) => {
    const app = apps.find((item) => item.id === link.app_id);
    return app && snapshots.some((snapshot) => snapshot.keyword_id === link.keyword_id && snapshot.store_app_id === app.store_app_id);
  });
  const staleCount = activeLinks.length - freshLinks.length;
  const isFresh = activeLinks.length > 0 && staleCount === 0 && lastOkAge <= 3 * 86400000 && latestRun?.status !== "failed";
  return { activeLinks, freshLinks, isFresh, lastOk, latestRun, staleCount };
}

async function addFreshnessContext(panel) {
  const { activeLinks, isFresh, lastOk, latestRun, staleCount } = await getCollectionHealth();
  const title = isFresh ? "Collection is current" : "Collection needs attention";
  const detail = isFresh
    ? `Last successful collection ${timeSince(lastOk.started_at)}.`
    : latestRun?.status === "failed"
      ? "The latest collection failed. Check Sync before acting on rank movement."
      : staleCount
        ? `${staleCount} of ${activeLinks.length} tracked keyword observation${staleCount === 1 ? " is" : "s are"} stale. Refresh coverage before acting on rank movement.`
      : lastOk
        ? `Last successful collection was ${timeSince(lastOk.started_at)}. Rankings may be stale.`
        : "No successful collection yet. Collect rankings before acting on visibility data.";
  panel.insertAdjacentHTML(
    "afterbegin",
    `<section class="aso-freshness-banner ${isFresh ? "ready" : "attention"}"><div><span>Data freshness</span><strong>${title}</strong><p>${detail}</p></div>${isFresh ? '<span class="status-ok">Current</span>' : '<button type="button" class="aso-link-button" data-open-sync>Open Sync</button>'}</section>`,
  );
  panel.querySelector("[data-open-sync]")?.addEventListener("click", () => {
    activeSubTab = "sync";
    document.querySelectorAll("[data-aso-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.asoTab === activeSubTab));
    renderSubTab(panel);
  });
}

// ── Portfolio ────────────────────────────────────────────────────────────

async function renderPortfolio(panel) {
  const today = toDateStr(new Date());
  const [apps, metrics, appKeywords, snapshots, insights] = await Promise.all([
    pg("aso_apps", "select=*&order=created_at.asc"),
    pg("aso_daily_metrics", `date=gte.${addDays(today, -30)}&select=*`),
    pg("aso_app_keywords", "select=*"),
    pg("aso_keyword_rank_snapshots", `app_kind=eq.owned&captured_at=gte.${addDays(today, -14)}&select=*`),
    pg("aso_insights", "status=eq.active&select=*"),
  ]);

  if (apps.length === 0) {
    panel.innerHTML = `<section class="panel"><h3>No apps tracked yet</h3><p class="empty-state">Use "+ Add app" above to add one by App Store URL or numeric id.</p></section>`;
    return;
  }

  const rows = apps.map((app) => {
    const appMetrics = metrics.filter((m) => m.app_id === app.id);
    const cmp = compareWindows(appMetrics, 14, today);
    const kwIds = new Set(appKeywords.filter((ak) => ak.app_id === app.id).map((ak) => ak.keyword_id));
    const appSnaps = snapshots.filter((sn) => kwIds.has(sn.keyword_id) && sn.store_app_id === app.store_app_id);
    const latest = [...latestSnapshots(appSnaps).values()];
    const gaining = latest.filter((sn) => (sn.change_7d ?? 0) > 1).length;
    const declining = latest.filter((sn) => (sn.change_7d ?? 0) < -1).length;
    const highInsights = insights.filter((i) => i.app_id === app.id && i.priority === "high").length;
    return { app, cmp, keywordCount: kwIds.size, gaining, declining, highInsights };
  });

  const totalDownloads = rows.reduce((a, r) => a + r.cmp.current.downloads, 0);
  const totalPv = rows.reduce((a, r) => a + r.cmp.current.page_views, 0);
  const avgConv = totalPv > 0 ? totalDownloads / totalPv : null;
  const sortedRows = [...rows].sort((a, b) => {
    if (portfolioSort === "downloads") return b.cmp.current.downloads - a.cmp.current.downloads;
    if (portfolioSort === "conversion") return (b.cmp.current.conversion ?? -1) - (a.cmp.current.conversion ?? -1);
    if (portfolioSort === "risk") return b.declining - a.declining || b.highInsights - a.highInsights;
    return b.highInsights - a.highInsights || b.declining - a.declining || b.cmp.current.downloads - a.cmp.current.downloads;
  });
  const countries = new Map();
  for (const metric of metrics.filter((item) => item.country && item.country !== "all")) {
    const app = apps.find((item) => item.id === metric.app_id);
    if (!app) continue;
    const key = `${app.id}:${metric.country}`;
    const country = countries.get(key) ?? { app, country: metric.country, impressions: 0, pageViews: 0, downloads: 0 };
    country.impressions += metric.impressions ?? 0;
    country.pageViews += metric.page_views ?? 0;
    country.downloads += metric.downloads ?? 0;
    countries.set(key, country);
  }
  const countryRows = [...countries.values()]
    .sort((a, b) => b.pageViews + b.downloads - (a.pageViews + a.downloads))
    .slice(0, 12);

  panel.innerHTML = `
    <div class="metric-grid">
      <article><span>Downloads, 14 days</span><strong>${formatNumber(totalDownloads)}</strong></article>
      <article><span>Avg conversion</span><strong>${avgConv != null ? formatPct(avgConv * 100, 1) : "—"}</strong></article>
      <article><span>Active insights</span><strong>${insights.length}</strong></article>
    </div>
    <div class="aso-portfolio-grid">
      <section class="panel">
        <div class="panel-head"><h3>Apps</h3><div class="aso-panel-actions"><span>select an app to open its keywords</span><select id="aso-portfolio-sort"><option value="insights" ${portfolioSort === "insights" ? "selected" : ""}>Sort: open insights</option><option value="risk" ${portfolioSort === "risk" ? "selected" : ""}>Sort: keyword risk</option><option value="downloads" ${portfolioSort === "downloads" ? "selected" : ""}>Sort: downloads</option><option value="conversion" ${portfolioSort === "conversion" ? "selected" : ""}>Sort: conversion</option></select></div></div>
      <table class="aso-table">
        <thead><tr><th>App</th><th>Version</th><th>Rating</th><th>Downloads 14d</th><th>Conv.</th><th>Keywords</th><th>▲/▼</th><th>Insights</th></tr></thead>
        <tbody>
          ${sortedRows
            .map(
              (r) => `<tr class="aso-row-link" data-focus-app="${r.app.id}">
                <td>${escapeHtml(r.app.name)}</td>
                <td class="mono">${escapeHtml(r.app.current_version ?? "—")}</td>
                <td class="mono">${r.app.rating != null ? `★ ${r.app.rating.toFixed(1)}` : "—"}</td>
                <td class="mono">${formatNumber(r.cmp.current.downloads)} <span class="delta ${deltaClass(r.cmp.downloads_pct)}">${formatPct(r.cmp.downloads_pct)}</span></td>
                <td class="mono">${r.cmp.current.conversion != null ? formatPct(r.cmp.current.conversion * 100, 1) : "—"}</td>
                <td class="mono">${r.keywordCount}</td>
                <td class="mono"><span class="up">${r.gaining}▲</span> <span class="down">${r.declining}▼</span></td>
                <td class="mono">${r.highInsights > 0 ? `<span class="down">${r.highInsights} high</span>` : "0"}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Storefront countries</h3><span>last 30 days</span></div>
      ${
        countryRows.length
          ? `<table class="aso-table">
              <thead><tr><th>App</th><th>Country</th><th>Impressions</th><th>Product page views</th><th>Downloads</th><th>Conversion</th></tr></thead>
              <tbody>${countryRows
                .map(
                  (row) => `<tr>
                    <td>${escapeHtml(row.app.name)}</td>
                    <td class="mono">${escapeHtml(row.country.toUpperCase())}</td>
                    <td class="mono">${formatNumber(row.impressions)}</td>
                    <td class="mono">${formatNumber(row.pageViews)}</td>
                    <td class="mono">${formatNumber(row.downloads)}</td>
                    <td class="mono">${row.pageViews ? formatPct((row.downloads / row.pageViews) * 100, 1) : "-"}</td>
                  </tr>`,
                )
                .join("")}</tbody>
            </table>`
          : '<p class="empty-state">Country metrics will appear after App Store Connect Discovery and Engagement reports are available.</p>'
      }
      </section>
    </div>
    <p class="empty-state">Downloads/conversion: last 14 days. Ranks are a public storefront snapshot (iTunes Search), not the exact on-device position.</p>
  `;
  panel.querySelector("#aso-portfolio-sort")?.addEventListener("change", (event) => {
    portfolioSort = event.target.value;
    renderSubTab(panel);
  });
  panel.querySelectorAll("[data-focus-app]").forEach((row) =>
    row.addEventListener("click", () => {
      keywordFilters.app = row.dataset.focusApp;
      activeSubTab = "keywords";
      document.querySelectorAll("[data-aso-tab]").forEach((button) => button.classList.toggle("active", button.dataset.asoTab === activeSubTab));
      renderSubTab(panel);
    }),
  );
}

const ALERT_KINDS = [
  ["performance", "Visibility and conversion"],
  ["keywords", "Keyword movement"],
  ["competitors", "Competitor movement"],
  ["reviews", "Review issues"],
  ["experiments", "Experiment outcomes"],
  ["operations", "Collection health"],
];

function alertSettingsHtml(preferences) {
  const preferenceMap = new Map(preferences.map((preference) => [preference.kind, preference.enabled]));
  return `<div class="aso-alert-settings">${ALERT_KINDS.map(([kind, label]) => `<label><input type="checkbox" data-alert-kind="${kind}" ${preferenceMap.get(kind) !== false ? "checked" : ""} /><span>${label}</span></label>`).join("")}</div>`;
}

function wireAlertSettings(panel) {
  panel.querySelectorAll("[data-alert-kind]").forEach((input) =>
    input.addEventListener("change", async () => {
      input.disabled = true;
      try {
        await pgUpsert("aso_alert_preferences", [{ kind: input.dataset.alertKind, enabled: input.checked }], "kind");
      } catch (error) {
        input.checked = !input.checked;
        alert(error.message);
      } finally {
        input.disabled = false;
      }
    }),
  );
}

async function renderBriefing(panel) {
  const today = toDateStr(new Date());
  const [apps, metrics, rawInsights, changes, reviews, experiments, health] = await Promise.all([
    pg("aso_apps", "select=id,name"),
    pg("aso_daily_metrics", `date=gte.${addDays(today, -14)}&select=*`),
    pg("aso_insights", "status=eq.active&select=*&order=created_at.desc"),
    pg("aso_metadata_change_events", `happened_at=gte.${addDays(today, -7)}&select=*&order=happened_at.desc`),
    pg("aso_reviews", `reviewed_at=gte.${addDays(today, -7)}&select=id,rating`),
    pg("aso_experiments", "status=in.(running,monitoring)&select=id,title,decision_recommendation"),
    getCollectionHealth(),
  ]);
  const insights = rawInsights.filter((insight) => insight.rule_id !== "data_collection_failure" || !health.isFresh);
  const comparison = compareWindows(metrics, 7, today);
  const priorities = { high: 0, medium: 1, low: 2 };
  const alerts = [...insights].sort((a, b) => priorities[a.priority] - priorities[b.priority]);
  const primaryAlerts = alerts.slice(0, 3);
  const remainingAlerts = alerts.slice(3);
  const highCount = insights.filter((insight) => insight.priority === "high").length;
  const competitorChanges = changes.filter((change) => change.competitor_id != null).length;
  const lowReviews = reviews.filter((review) => review.rating <= 2).length;
  const recommendations = experiments.filter((experiment) => ["winner", "loser", "inconclusive"].includes(experiment.decision_recommendation)).length;
  const lastOk = health.lastOk;
  const lines = [
    `Kopa ASO weekly briefing - ${today}`,
    `Downloads: ${formatNumber(comparison.current.downloads)} (${formatPct(comparison.downloads_pct)})`,
    `Product-page views: ${formatNumber(comparison.current.page_views)} (${formatPct(comparison.page_views_pct)})`,
    `Impressions: ${formatNumber(comparison.current.impressions)} (${formatPct(comparison.impressions_pct)})`,
    `Active high-priority signals: ${highCount}`,
    ...primaryAlerts.map((alert) => `- [${alert.priority}] ${alert.title}: ${alert.recommendation}`),
  ];

  panel.innerHTML = `
    <section class="panel aso-briefing-summary">
      <div class="panel-head"><h3>Weekly briefing</h3><span>week ending ${today} · data refreshed ${timeSince(lastOk?.started_at)}</span></div>
      <div class="metric-grid">
        <article><span>Downloads</span><strong>${formatNumber(comparison.current.downloads)}</strong><small class="${deltaClass(comparison.downloads_pct)}">${formatPct(comparison.downloads_pct)}</small></article>
        <article><span>Product-page views</span><strong>${formatNumber(comparison.current.page_views)}</strong><small class="${deltaClass(comparison.page_views_pct)}">${formatPct(comparison.page_views_pct)}</small></article>
        <article><span>Impressions</span><strong>${formatNumber(comparison.current.impressions)}</strong><small class="${deltaClass(comparison.impressions_pct)}">${formatPct(comparison.impressions_pct)}</small></article>
        <article><span>High-priority signals</span><strong>${highCount}</strong><small>${insights.length} active</small></article>
      </div>
      <button type="button" class="aso-link-button" id="aso-copy-briefing">Copy briefing</button>
      <p id="aso-briefing-status" class="empty-state" hidden></p>
    </section>
    <div class="aso-briefing-grid">
    <section class="panel aso-briefing-actions">
      <div class="panel-head"><h3>Act this week</h3><span>${primaryAlerts.length} decisive action${primaryAlerts.length === 1 ? "" : "s"}</span></div>
      ${
        primaryAlerts.length
          ? primaryAlerts
              .map((alert) => { const destination = insightDestination(alert); return `<div class="aso-briefing-action"><div><span class="priority-${alert.priority}">${alert.priority}</span><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.recommendation)}</p><small>Next outcome: ${escapeHtml(destination.label)}</small></div><div><button type="button" class="aso-link-button" data-briefing-open="${destination.tab}">${destination.label}</button><button type="button" class="aso-link-button" data-briefing-action="completed" data-insight-id="${alert.id}">Done</button><button type="button" class="aso-link-button" data-briefing-action="snoozed" data-insight-id="${alert.id}">Snooze</button></div></div>`; })
              .join("")
          : '<p class="empty-state">No active signals yet. Kopa will add a briefing item when there is enough evidence to act.</p>'
      }
      ${remainingAlerts.length ? `<details class="aso-briefing-more"><summary>${remainingAlerts.length} more active signal${remainingAlerts.length === 1 ? "" : "s"}</summary><div>${remainingAlerts.map((alert) => { const destination = insightDestination(alert); return `<div class="aso-briefing-action"><div><span class="priority-${alert.priority}">${alert.priority}</span><strong>${escapeHtml(alert.title)}</strong></div><button type="button" class="aso-link-button" data-briefing-open="${destination.tab}">${destination.label}</button></div>`; }).join("")}</div></details>` : ""}
    </section>
    <div class="aso-briefing-side">
    <section class="panel">
      <div class="panel-head"><h3>Watchlist</h3><span>last 7 days</span></div>
      <div class="aso-evidence">
        <div><dt>Competitor metadata changes</dt><dd>${competitorChanges}</dd></div>
        <div><dt>New low-star reviews</dt><dd>${lowReviews}</dd></div>
        <div><dt>Experiment recommendations</dt><dd>${recommendations}</dd></div>
        <div><dt>Tracked apps</dt><dd>${apps.length}</dd></div>
      </div>
    </section>
    </div>
    </div>
  `;

  panel.querySelector("#aso-copy-briefing").addEventListener("click", async (event) => {
    const status = panel.querySelector("#aso-briefing-status");
    status.hidden = false;
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      status.textContent = "Briefing copied.";
      event.target.disabled = true;
    } catch {
      status.textContent = "Could not copy the briefing in this browser.";
    }
  });

  panel.querySelectorAll("[data-briefing-open]").forEach((button) =>
    button.addEventListener("click", () => {
      activeSubTab = button.dataset.briefingOpen;
      document.querySelectorAll("[data-aso-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.asoTab === activeSubTab));
      renderSubTab(panel);
    }),
  );
  panel.querySelectorAll("[data-briefing-action]").forEach((button) =>
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const patch = { status: button.dataset.briefingAction, updated_at: new Date().toISOString() };
        if (patch.status === "snoozed") patch.snoozed_until = new Date(Date.now() + 14 * 86400000).toISOString();
        await pgWrite("PATCH", "aso_insights", patch, `id=eq.${button.dataset.insightId}`);
        renderSubTab(panel);
      } catch (error) {
        button.disabled = false;
        alert(error.message);
      }
    }),
  );
}

function deltaClass(v) {
  if (v == null) return "";
  return v > 0 ? "up" : v < 0 ? "down" : "";
}

function timeSince(value) {
  if (!value) return "Never";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function wireScrollActions(panel) {
  panel.querySelectorAll("[data-scroll-to]").forEach((button) =>
    button.addEventListener("click", () => panel.querySelector(`#${button.dataset.scrollTo}`)?.scrollIntoView({ behavior: "smooth", block: "start" })),
  );
}

function filteredKeywordRows(rows) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const query = keywordFilters.query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const movement = row.latest?.change_7d ?? 0;
    const priority = row.link.priority ?? row.keyword.priority;
    if (query && !`${row.keyword.term} ${row.app.name}`.toLowerCase().includes(query)) return false;
    if (keywordFilters.app !== "all" && row.app.id !== keywordFilters.app) return false;
    if (keywordFilters.country !== "all" && row.keyword.country !== keywordFilters.country) return false;
    if (keywordFilters.priority !== "all" && priority !== keywordFilters.priority) return false;
    if (keywordFilters.movement === "gaining" && movement <= 0) return false;
    if (keywordFilters.movement === "declining" && movement >= 0) return false;
    if (keywordFilters.movement === "stable" && movement !== 0) return false;
    if (keywordFilters.movement === "unranked" && row.latest?.rank != null) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    if (keywordFilters.sort === "rank") return (a.latest?.rank ?? Infinity) - (b.latest?.rank ?? Infinity) || a.keyword.term.localeCompare(b.keyword.term);
    if (keywordFilters.sort === "movement") return Math.abs(b.latest?.change_7d ?? 0) - Math.abs(a.latest?.change_7d ?? 0) || a.keyword.term.localeCompare(b.keyword.term);
    if (keywordFilters.sort === "term") return a.keyword.term.localeCompare(b.keyword.term);
    return (priorityOrder[a.link.priority ?? a.keyword.priority] ?? 9) - (priorityOrder[b.link.priority ?? b.keyword.priority] ?? 9) || a.keyword.term.localeCompare(b.keyword.term);
  });
}

function keywordToolbarHtml(rows) {
  const apps = [...new Map(rows.map((row) => [row.app.id, row.app])).values()];
  const countries = [...new Set(rows.map((row) => row.keyword.country))].sort();
  return `<div class="aso-keyword-toolbar">
    <input type="search" id="aso-keyword-search" value="${escapeHtml(keywordFilters.query)}" placeholder="Search keyword or app" />
    <select id="aso-keyword-app"><option value="all">All apps</option>${apps.map((app) => `<option value="${app.id}" ${keywordFilters.app === app.id ? "selected" : ""}>${escapeHtml(app.name)}</option>`).join("")}</select>
    <select id="aso-keyword-country"><option value="all">All countries</option>${countries.map((country) => `<option value="${escapeHtml(country)}" ${keywordFilters.country === country ? "selected" : ""}>${escapeHtml(country.toUpperCase())}</option>`).join("")}</select>
    <select id="aso-keyword-priority"><option value="all">All priorities</option>${["high", "medium", "low"].map((priority) => `<option value="${priority}" ${keywordFilters.priority === priority ? "selected" : ""}>${priority[0].toUpperCase()}${priority.slice(1)} priority</option>`).join("")}</select>
    <select id="aso-keyword-movement"><option value="all">All movement</option><option value="gaining" ${keywordFilters.movement === "gaining" ? "selected" : ""}>Gaining</option><option value="declining" ${keywordFilters.movement === "declining" ? "selected" : ""}>Declining</option><option value="stable" ${keywordFilters.movement === "stable" ? "selected" : ""}>Stable</option><option value="unranked" ${keywordFilters.movement === "unranked" ? "selected" : ""}>Unranked</option></select>
    <select id="aso-keyword-sort"><option value="priority" ${keywordFilters.sort === "priority" ? "selected" : ""}>Sort: priority</option><option value="rank" ${keywordFilters.sort === "rank" ? "selected" : ""}>Sort: best rank</option><option value="movement" ${keywordFilters.sort === "movement" ? "selected" : ""}>Sort: biggest movement</option><option value="term" ${keywordFilters.sort === "term" ? "selected" : ""}>Sort: keyword A-Z</option></select>
    <button type="button" class="aso-link-button" data-clear-keyword-filters>Clear</button>
  </div>`;
}

const KEYWORD_VIEW_PRESETS = [
  ["high_unranked", "High-priority unranked", { priority: "high", movement: "unranked", sort: "priority" }],
  ["high_declining", "High-priority declines", { priority: "high", movement: "declining", sort: "movement" }],
  ["us_opportunity", "US opportunities", { country: "us", priority: "high", movement: "unranked", sort: "priority" }],
];

function keywordViewsHtml() {
  const saved = getSavedKeywordViews();
  return `<div class="aso-keyword-views"><select id="aso-keyword-view"><option value="">Views</option><optgroup label="Suggested">${KEYWORD_VIEW_PRESETS.map(([id, label]) => `<option value="preset:${id}">${label}</option>`).join("")}</optgroup>${saved.length ? `<optgroup label="Saved">${saved.map((view) => `<option value="saved:${escapeHtml(view.id)}">${escapeHtml(view.name)}</option>`).join("")}</optgroup>` : ""}</select><input id="aso-keyword-view-name" type="text" maxlength="40" placeholder="Save current view" /><button type="button" class="aso-link-button" data-save-keyword-view>Save</button><button type="button" class="aso-link-button" data-delete-keyword-view disabled>Delete</button></div>`;
}

// ── Keywords ─────────────────────────────────────────────────────────────

async function renderKeywords(panel) {
  const today = toDateStr(new Date());
  const [keywords, appKeywords, apps, snapshots, competitors, groups] = await Promise.all([
    pg("aso_keywords", "select=*"),
    pg("aso_app_keywords", "select=*"),
    pg("aso_apps", "select=*"),
    pg("aso_keyword_rank_snapshots", `captured_at=gte.${addDays(today, -35)}&select=*`),
    pg("aso_competitors", "select=*"),
    pg("aso_keyword_groups", "select=*"),
  ]);

  if (apps.length === 0) {
    panel.innerHTML = `<section class="panel"><h3>Add an app first</h3><p class="empty-state">Keywords are tracked per app — use "+ Add app" above before adding keywords.</p></section>`;
    return;
  }

  if (keywords.length === 0) {
    keywordFormOpen = true;
    panel.innerHTML = `<section class="panel"><h3>No keywords tracked yet</h3><p class="empty-state">Add your first keyword to begin collecting search visibility.</p></section>${renderKeywordFormHtml(apps)}`;
    wireKeywordToolbar(panel);
    wireKeywordForm(panel);
    return;
  }

  const rows = appKeywords
    .map((link) => {
      const keyword = keywords.find((k) => k.id === link.keyword_id);
      const app = apps.find((a) => a.id === link.app_id);
      if (!keyword || !app) return null;
      const kwSnaps = snapshots.filter((sn) => sn.keyword_id === keyword.id).sort((a, b) => (a.captured_at < b.captured_at ? -1 : 1));
      const owned = kwSnaps.filter((sn) => sn.store_app_id === app.store_app_id && sn.app_kind === "owned");
      const latest = owned[owned.length - 1] ?? null;
      const compCount = new Set(kwSnaps.filter((sn) => sn.app_kind === "competitor").map((sn) => sn.store_app_id)).size;
      return { link, keyword, app, latest, compCount };
    })
    .filter(Boolean);

  const editingRow = editingKeywordLinkId ? rows.find((r) => r.link.id === editingKeywordLinkId) : null;
  const gaining = rows.filter((r) => (r.latest?.change_7d ?? 0) > 0).length;
  const declining = rows.filter((r) => (r.latest?.change_7d ?? 0) < 0).length;
  const ranked = rows.filter((r) => r.latest?.rank != null).length;
  const visibleRows = filteredKeywordRows(rows);
  const visibleIds = new Set(visibleRows.map((row) => row.link.id));
  const selectedCount = [...selectedKeywordLinkIds].filter((id) => rows.some((row) => row.link.id === id)).length;
  const editorHtml = editingRow ? renderKeywordEditHtml(editingRow, groups) : keywordFormOpen ? renderKeywordFormHtml(apps) : "";

  panel.innerHTML = `
    <div class="mini-stat-grid aso-workflow-summary">
      <article><span>Tracked terms</span><strong>${rows.length}</strong></article>
      <article><span>Gaining, 7 days</span><strong class="up">${gaining}</strong></article>
      <article><span>Declining, 7 days</span><strong class="down">${declining}</strong></article>
      <article><span>Currently ranked</span><strong>${ranked}</strong></article>
    </div>
    ${editorHtml}
    <section class="panel">
      <div class="panel-head"><h3>Keywords</h3><div class="aso-panel-actions"><span>${visibleRows.length}/${rows.length} shown</span><button type="button" class="aso-action-primary" data-open-keyword-form>${keywordFormOpen ? "Adding keywords" : "Add keywords"}</button></div></div>
      ${keywordViewsHtml()}
      ${keywordToolbarHtml(rows)}
      <div class="aso-keyword-bulk ${selectedCount ? "active" : ""}"><span>${selectedCount ? `${selectedCount} selected` : "Select terms to update in bulk"}</span><select id="aso-bulk-priority" ${selectedCount ? "" : "disabled"}><option value="">Set priority</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><button type="button" class="aso-link-button" data-apply-bulk-priority ${selectedCount ? "" : "disabled"}>Apply</button><button type="button" class="aso-link-button" data-pause-keywords ${selectedCount ? "" : "disabled"}>Pause</button></div>
      <table class="aso-table">
        <thead><tr><th><input type="checkbox" aria-label="Select shown keywords" data-select-visible ${visibleRows.length && visibleRows.every((row) => selectedKeywordLinkIds.has(row.link.id)) ? "checked" : ""} ${visibleRows.length ? "" : "disabled"} /></th><th>Keyword</th><th>App</th><th>Country</th><th>Rank</th><th>7d</th><th>30d</th><th>Best</th><th>Comp.</th><th>Priority</th><th>Actions</th></tr></thead>
        <tbody>
          ${visibleRows.length
            ? visibleRows
            .map(
              (r) => `<tr>
                <td><input type="checkbox" aria-label="Select ${escapeHtml(r.keyword.term)}" data-select-keyword="${r.link.id}" ${selectedKeywordLinkIds.has(r.link.id) ? "checked" : ""} /></td>
                <td>${escapeHtml(r.keyword.term)}</td>
                <td class="mono">${escapeHtml(r.app.name.split(" ")[0])}</td>
                <td class="mono">${r.keyword.country.toUpperCase()}</td>
                <td class="mono">${formatRank(r.latest?.rank ?? null)}</td>
                <td class="mono">${rankDelta(r.latest?.change_7d)}</td>
                <td class="mono">${rankDelta(r.latest?.change_30d)}</td>
                <td class="mono">${r.latest?.best_rank != null ? `#${r.latest.best_rank}` : "—"}</td>
                <td class="mono">${r.compCount || "—"}</td>
                <td class="mono">${escapeHtml(r.link.priority ?? r.keyword.priority)}</td>
                <td class="mono aso-table-actions">
                  <button type="button" data-edit-keyword="${r.link.id}">Edit</button>
                  <button type="button" data-delete-keyword="${r.link.id}">Delete</button>
                </td>
              </tr>`,
            )
            .join("")
            : '<tr><td colspan="11" class="empty-state">No keywords match these filters.</td></tr>'}
        </tbody>
      </table>
    </section>
    <p class="empty-state">${competitors.length} competitor(s) tracked across the portfolio.</p>
  `;
  wireKeywordActions(panel, rows);
  wireKeywordToolbar(panel);
  wireKeywordViews(panel);
  wireKeywordBulkActions(panel, visibleIds);
  if (editingRow) wireKeywordEditForm(panel, editingRow, appKeywords);
  if (keywordFormOpen) wireKeywordForm(panel);
}

function rankDelta(value) {
  if (value == null || value === 0) return `<span class="mono">${value === 0 ? "0" : "—"}</span>`;
  return `<span class="${value > 0 ? "up" : "down"}">${value > 0 ? "▲" : "▼"}${Math.abs(value)}</span>`;
}

function renderKeywordFormHtml(apps) {
  return `
    <section class="panel" id="aso-keyword-form">
      <div class="panel-head"><h3>Add keywords</h3><div class="aso-panel-actions"><span>one per line, collected once per day per country</span><button type="button" class="aso-link-button" data-close-keyword-form>Close</button></div></div>
      <label class="aso-field">
        <span>App</span>
        <select id="aso-kw-app">
          ${apps.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("")}
        </select>
      </label>
      <label class="aso-field">
        <span>Keywords</span>
        <textarea id="aso-kw-terms" rows="4" placeholder="parking puzzle
car escape game"></textarea>
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Country</span>
        <input id="aso-kw-country" type="text" value="us" maxlength="2" />
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Priority</span>
        <select id="aso-kw-priority">
          <option value="high">High</option>
          <option value="medium" selected>Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Group (optional)</span>
        <input id="aso-kw-group" type="text" placeholder="Core" />
      </label>
      <button type="button" id="aso-kw-submit">Track keywords</button>
      <p id="aso-kw-status" class="empty-state" hidden></p>
    </section>
  `;
}

function renderKeywordEditHtml(row, groups) {
  const currentGroup = groups.find((g) => g.id === row.link.group_id);
  return `
    <section class="panel">
      <div class="panel-head">
        <h3>Edit keyword</h3>
        <button type="button" class="aso-link-button" data-cancel-keyword-edit>Cancel</button>
      </div>
      <label class="aso-field">
        <span>Keyword</span>
        <input id="aso-edit-term" type="text" value="${escapeHtml(row.keyword.term)}" />
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Country</span>
        <input id="aso-edit-country" type="text" value="${escapeHtml(row.keyword.country)}" maxlength="2" />
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Priority</span>
        <select id="aso-edit-priority">
          ${["high", "medium", "low"].map((p) => `<option value="${p}" ${(row.link.priority ?? row.keyword.priority) === p ? "selected" : ""}>${p[0].toUpperCase()}${p.slice(1)}</option>`).join("")}
        </select>
      </label>
      <label class="aso-field">
        <span>Group (optional)</span>
        <input id="aso-edit-group" type="text" value="${escapeHtml(currentGroup?.name ?? "")}" placeholder="Core" />
      </label>
      <label class="aso-field">
        <span>Notes (optional)</span>
        <textarea id="aso-edit-notes" rows="3" placeholder="Why are we tracking this?">${escapeHtml(row.link.notes ?? "")}</textarea>
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Target rank (optional)</span>
        <input id="aso-edit-target-rank" type="number" min="1" value="${row.link.target_rank ?? ""}" />
      </label>
      <button type="button" id="aso-edit-submit">Save keyword</button>
      <p id="aso-edit-status" class="empty-state" hidden></p>
    </section>
  `;
}

async function keywordGroupIdFromName(name) {
  const groupName = name.trim();
  if (!groupName) return null;
  const existing = await pg("aso_keyword_groups", `name=eq.${encodeURIComponent(groupName)}&select=id`);
  if (existing.length) return existing[0].id;
  const [group] = await pgWrite("POST", "aso_keyword_groups", [{ name: groupName, kind: "core" }]);
  return group.id;
}

function wireKeywordActions(panel, rows) {
  panel.querySelectorAll("[data-edit-keyword]").forEach((btn) =>
    btn.addEventListener("click", () => {
      editingKeywordLinkId = btn.dataset.editKeyword;
      keywordFormOpen = false;
      renderSubTab(panel);
    }),
  );

  panel.querySelectorAll("[data-delete-keyword]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const row = rows.find((r) => r.link.id === btn.dataset.deleteKeyword);
      if (!row) return;
      const ok = confirm(`Stop tracking "${row.keyword.term}" for ${row.app.name}? Existing historical snapshots will be removed if no other app tracks this keyword.`);
      if (!ok) return;
      btn.disabled = true;
      try {
        await pgWrite("DELETE", "aso_app_keywords", null, `id=eq.${row.link.id}`);
        const remainingLinks = await pg("aso_app_keywords", `keyword_id=eq.${row.keyword.id}&select=id&limit=1`);
        if (remainingLinks.length === 0) {
          await pgWrite("DELETE", "aso_keywords", null, `id=eq.${row.keyword.id}`);
        }
        if (editingKeywordLinkId === row.link.id) editingKeywordLinkId = null;
        renderSubTab(panel);
      } catch (error) {
        btn.disabled = false;
        alert(error.message);
      }
    }),
  );
}

function wireKeywordToolbar(panel) {
  panel.querySelector("[data-open-keyword-form]")?.addEventListener("click", () => {
    if (keywordFormOpen) return;
    editingKeywordLinkId = null;
    keywordFormOpen = true;
    renderSubTab(panel);
  });
  panel.querySelector("[data-close-keyword-form]")?.addEventListener("click", () => {
    keywordFormOpen = false;
    renderSubTab(panel);
  });
  panel.querySelector("[data-clear-keyword-filters]")?.addEventListener("click", () => {
    keywordFilters = { query: "", app: "all", country: "all", priority: "all", movement: "all", sort: "priority" };
    renderSubTab(panel);
  });
  const fields = [
    ["#aso-keyword-search", "query"],
    ["#aso-keyword-app", "app"],
    ["#aso-keyword-country", "country"],
    ["#aso-keyword-priority", "priority"],
    ["#aso-keyword-movement", "movement"],
    ["#aso-keyword-sort", "sort"],
  ];
  fields.forEach(([selector, key]) => {
    const input = panel.querySelector(selector);
    if (!input) return;
    input.addEventListener("change", () => {
      keywordFilters[key] = input.value;
      renderSubTab(panel);
    });
    if (key === "query") {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        keywordFilters.query = input.value;
        renderSubTab(panel);
      });
    }
  });
}

function wireKeywordViews(panel) {
  const viewSelect = panel.querySelector("#aso-keyword-view");
  const deleteButton = panel.querySelector("[data-delete-keyword-view]");
  viewSelect?.addEventListener("change", () => {
    const value = viewSelect.value;
    deleteButton.disabled = !value.startsWith("saved:");
    if (!value) return;
    let filters = null;
    if (value.startsWith("preset:")) filters = KEYWORD_VIEW_PRESETS.find(([id]) => id === value.slice(7))?.[2];
    if (value.startsWith("saved:")) filters = getSavedKeywordViews().find((view) => view.id === value.slice(6))?.filters;
    if (!filters) return;
    keywordFilters = { ...keywordFilters, ...filters };
    selectedKeywordLinkIds.clear();
    renderSubTab(panel);
  });
  panel.querySelector("[data-save-keyword-view]")?.addEventListener("click", () => {
    const input = panel.querySelector("#aso-keyword-view-name");
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    const views = getSavedKeywordViews();
    views.push({ id: crypto.randomUUID(), name, filters: { ...keywordFilters } });
    saveKeywordViews(views.slice(-12));
    renderSubTab(panel);
  });
  deleteButton?.addEventListener("click", () => {
    const value = viewSelect.value;
    if (!value.startsWith("saved:")) return;
    saveKeywordViews(getSavedKeywordViews().filter((view) => view.id !== value.slice(6)));
    renderSubTab(panel);
  });
}

function wireKeywordBulkActions(panel, visibleIds) {
  panel.querySelectorAll("[data-select-keyword]").forEach((input) =>
    input.addEventListener("change", () => {
      if (input.checked) selectedKeywordLinkIds.add(input.dataset.selectKeyword);
      else selectedKeywordLinkIds.delete(input.dataset.selectKeyword);
      renderSubTab(panel);
    }),
  );
  panel.querySelector("[data-select-visible]")?.addEventListener("change", (event) => {
    if (event.target.checked) visibleIds.forEach((id) => selectedKeywordLinkIds.add(id));
    else visibleIds.forEach((id) => selectedKeywordLinkIds.delete(id));
    renderSubTab(panel);
  });
  const updateSelected = async (patch, label) => {
    const ids = [...selectedKeywordLinkIds];
    if (!ids.length) return;
    const button = panel.querySelector(`[data-${label}]`);
    if (label === "pause-keywords" && !confirm(`Pause ${ids.length} tracked keyword${ids.length === 1 ? "" : "s"}?`)) return;
    button.disabled = true;
    try {
      await pgWrite("PATCH", "aso_app_keywords", { ...patch, updated_at: new Date().toISOString() }, `id=in.(${ids.join(",")})`);
      selectedKeywordLinkIds.clear();
      renderSubTab(panel);
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  };
  panel.querySelector("[data-apply-bulk-priority]")?.addEventListener("click", () => {
    const priority = panel.querySelector("#aso-bulk-priority").value;
    if (priority) updateSelected({ priority }, "apply-bulk-priority");
  });
  panel.querySelector("[data-pause-keywords]")?.addEventListener("click", () => updateSelected({ status: "paused" }, "pause-keywords"));
}

function wireKeywordEditForm(panel, row, appKeywords) {
  panel.querySelector("[data-cancel-keyword-edit]")?.addEventListener("click", () => {
    editingKeywordLinkId = null;
    renderSubTab(panel);
  });

  panel.querySelector("#aso-edit-submit")?.addEventListener("click", async () => {
    const submit = panel.querySelector("#aso-edit-submit");
    const status = panel.querySelector("#aso-edit-status");
    const term = panel.querySelector("#aso-edit-term").value.trim().toLowerCase();
    const priority = panel.querySelector("#aso-edit-priority").value;
    const groupName = panel.querySelector("#aso-edit-group").value;
    const notes = panel.querySelector("#aso-edit-notes").value.trim() || null;
    const targetRankValue = panel.querySelector("#aso-edit-target-rank").value;
    const targetRank = targetRankValue ? Number(targetRankValue) : null;
    status.hidden = false;

    if (term.length < 2) {
      status.textContent = "Keyword must be at least two characters.";
      return;
    }
    if (targetRank != null && (!Number.isInteger(targetRank) || targetRank < 1)) {
      status.textContent = "Target rank must be a whole number greater than zero.";
      return;
    }

    let countryInfo;
    try {
      countryInfo = normalizeCountry(panel.querySelector("#aso-edit-country").value);
    } catch (error) {
      status.textContent = error.message;
      return;
    }

    const sharedCount = appKeywords.filter((link) => link.keyword_id === row.keyword.id).length;
    if (sharedCount > 1 && (term !== row.keyword.term || countryInfo.country !== row.keyword.country)) {
      const ok = confirm(`This keyword is tracked by ${sharedCount} apps. Editing the term or country changes it everywhere. Continue?`);
      if (!ok) return;
    }

    submit.disabled = true;
    status.textContent = "Saving…";
    try {
      const groupId = await keywordGroupIdFromName(groupName);
      await pgWrite(
        "PATCH",
        "aso_keywords",
        {
          term,
          country: countryInfo.country,
        },
        `id=eq.${row.keyword.id}`,
      );
      await pgWrite(
        "PATCH",
        "aso_app_keywords",
        { priority, group_id: groupId, notes, target_rank: targetRank, updated_at: new Date().toISOString() },
        `id=eq.${row.link.id}`,
      );
      editingKeywordLinkId = null;
      status.textContent = countryInfo.warning ? `${countryInfo.warning} Saved as ${countryInfo.country.toUpperCase()}.` : "Saved.";
      setTimeout(() => renderSubTab(panel), 700);
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
}

function wireKeywordForm(panel) {
  const submit = panel.querySelector("#aso-kw-submit");
  if (!submit) return;
  submit.addEventListener("click", async () => {
    const appId = panel.querySelector("#aso-kw-app").value;
    const priority = panel.querySelector("#aso-kw-priority").value;
    const groupName = panel.querySelector("#aso-kw-group").value.trim();
    const terms = panel
      .querySelector("#aso-kw-terms")
      .value.split(/[\n,]/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 1);
    const status = panel.querySelector("#aso-kw-status");
    status.hidden = false;

    if (terms.length === 0) {
      status.textContent = "Enter at least one keyword.";
      return;
    }
    let countryInfo;
    try {
      countryInfo = normalizeCountry(panel.querySelector("#aso-kw-country").value);
    } catch (error) {
      status.textContent = error.message;
      return;
    }
    submit.disabled = true;
    status.textContent = "Saving…";
    try {
      const groupId = await keywordGroupIdFromName(groupName);
      for (const term of terms) {
        const [keyword] = await pgUpsert(
          "aso_keywords",
          [{ term, country: countryInfo.country, language: null, group_id: null, priority: "medium", notes: null }],
          "term,country",
        );
        await pgUpsert(
          "aso_app_keywords",
          [{ app_id: appId, keyword_id: keyword.id, priority, group_id: groupId, notes: null, target_rank: null, status: "active", updated_at: new Date().toISOString() }],
          "app_id,keyword_id",
        );
      }
      const warning = countryInfo.warning ? `${countryInfo.warning} ` : "";
      status.textContent = `${warning}Tracking ${terms.length} keyword(s) in ${countryInfo.country.toUpperCase()}. Run a collection from the Sync tab to start ranking them.`;
      keywordFormOpen = false;
      setTimeout(() => renderSubTab(panel), 1200);
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
}

// ── Insights ─────────────────────────────────────────────────────────────

function insightSource(ruleId) {
  if (ruleId === "data_collection_failure") return "operations";
  if (ruleId.startsWith("competitor_")) return "competitors";
  if (ruleId.startsWith("review_")) return "reviews";
  if (ruleId.startsWith("experiment_")) return "experiments";
  if (ruleId.includes("keyword") || ruleId === "metadata_mismatch") return "keywords";
  return "performance";
}

function insightDestination(insight) {
  const source = insightSource(insight.rule_id);
  if (source === "operations") return { tab: "sync", label: "Open Sync" };
  if (source === "competitors") return { tab: "competitors", label: "Open competitors" };
  if (source === "reviews") return { tab: "reviews", label: "Open reviews" };
  if (source === "experiments") return { tab: "experiments", label: "Open experiment" };
  if (source === "keywords") return { tab: "keywords", label: "Open keywords" };
  return { tab: "experiments", label: "Plan experiment" };
}

function metadataMarkets(insight) {
  if (insight.rule_id !== "metadata_mismatch") return [];
  const terms = insight.evidence?.find((item) => item.label === "Missing terms")?.value ?? "";
  const counts = new Map();
  for (const match of terms.matchAll(/\(([A-Z]{2})\)/g)) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function renderInsights(panel) {
  const [rawInsights, apps, keywords, health] = await Promise.all([
    pg("aso_insights", "status=eq.active&select=*&order=created_at.desc"),
    pg("aso_apps", "select=*"),
    pg("aso_keywords", "select=*"),
    getCollectionHealth(),
  ]);
  const insights = rawInsights.filter((insight) => insight.rule_id !== "data_collection_failure" || !health.isFresh);

  if (insights.length === 0) {
    panel.innerHTML = `<section class="panel"><h3>No active insights</h3><p class="empty-state">The rule engine only speaks when it has evidence — thin or stale data stays silent. Run a collection from the Sync tab once you have a few days of data.</p></section>`;
    return;
  }

  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...insights].sort((a, b) => order[a.priority] - order[b.priority]);
  const visibleInsights = sorted.filter((insight) => {
    if (insightFilters.app !== "all" && insight.app_id !== insightFilters.app) return false;
    if (insightFilters.priority === "important" && !["high", "medium"].includes(insight.priority)) return false;
    if (insightFilters.priority !== "all" && insightFilters.priority !== "important" && insight.priority !== insightFilters.priority) return false;
    if (insightFilters.source !== "all" && insightSource(insight.rule_id) !== insightFilters.source) return false;
    return true;
  });
  const highCount = insights.filter((insight) => insight.priority === "high").length;
  const mediumCount = insights.filter((insight) => insight.priority === "medium").length;

  panel.innerHTML = `<div class="mini-stat-grid aso-workflow-summary">
      <article><span>Active signals</span><strong>${insights.length}</strong></article>
      <article><span>High priority</span><strong class="down">${highCount}</strong></article>
      <article><span>Medium priority</span><strong>${mediumCount}</strong></article>
      <article><span>Apps affected</span><strong>${new Set(insights.map((insight) => insight.app_id).filter(Boolean)).size}</strong></article>
    </div>
    <div class="aso-filter-toolbar">
      <select id="aso-insight-app"><option value="all">All apps</option>${apps.map((app) => `<option value="${app.id}" ${insightFilters.app === app.id ? "selected" : ""}>${escapeHtml(app.name)}</option>`).join("")}</select>
      <select id="aso-insight-priority"><option value="important" ${insightFilters.priority === "important" ? "selected" : ""}>High and medium priority</option><option value="high" ${insightFilters.priority === "high" ? "selected" : ""}>High priority only</option><option value="medium" ${insightFilters.priority === "medium" ? "selected" : ""}>Medium priority only</option><option value="low" ${insightFilters.priority === "low" ? "selected" : ""}>Low priority only</option><option value="all" ${insightFilters.priority === "all" ? "selected" : ""}>All priorities</option></select>
      <select id="aso-insight-source"><option value="all">All sources</option>${[["keywords", "Keywords"], ["competitors", "Competitors"], ["reviews", "Reviews"], ["experiments", "Experiments"], ["operations", "Operations"], ["performance", "Performance"]].map(([value, label]) => `<option value="${value}" ${insightFilters.source === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      <span>${visibleInsights.length}/${insights.length} shown</span>
    </div>` + (visibleInsights.length ? visibleInsights : [])
    .map((i) => {
      const app = apps.find((a) => a.id === i.app_id);
      const keyword = keywords.find((k) => k.id === i.keyword_id);
      const destination = insightDestination(i);
      const markets = metadataMarkets(i);
      return `
      <article class="panel aso-insight">
        <div class="panel-head">
          <h3>${escapeHtml(i.title)}</h3>
          <span class="priority-${i.priority}">${i.priority} priority</span>
        </div>
        <p class="aso-insight-summary">${escapeHtml(i.observation)}</p>
        <p class="aso-insight-next"><strong>Next:</strong> ${escapeHtml(i.recommendation)}</p>
        <div class="aso-insight-meta">
          <span>Confidence: ${escapeHtml(i.confidence.replace("_", "-"))}</span>
          <span>Impact: ${escapeHtml(i.impact)}</span>
          <span>Effort: ${escapeHtml(i.effort)}</span>
          ${app ? `<span>${escapeHtml(app.name)}</span>` : ""}
          ${keyword ? `<span>"${escapeHtml(keyword.term)}"</span>` : ""}
        </div>
        ${markets.length ? `<div class="aso-market-groups"><span>Missing by market</span>${markets.map(([country, count]) => `<b>${country} · ${count}</b>`).join("")}</div>` : ""}
        <div class="aso-insight-actions">
          <button type="button" class="aso-action-primary" data-insight-destination="${destination.tab}">${destination.label}</button>
          ${["competitors", "keywords", "performance"].includes(insightSource(i.rule_id)) && i.app_id ? `<button type="button" class="aso-link-button" data-create-experiment data-insight-id="${i.id}">Create experiment</button>` : ""}
          <details class="aso-secondary-actions"><summary>More</summary><div><button type="button" data-insight-action="completed" data-insight-id="${i.id}">Mark done</button><button type="button" data-insight-action="snoozed" data-insight-id="${i.id}">Snooze 14d</button><button type="button" data-insight-action="dismissed" data-insight-id="${i.id}">Dismiss</button></div></details>
        </div>
        <details class="aso-insight-detail"><summary>Evidence and reasoning</summary><div><p class="muted">${escapeHtml(i.interpretation)}</p><dl class="aso-evidence">${i.evidence.map((e) => `<div><dt>${escapeHtml(e.label)}</dt><dd>${escapeHtml(e.value)}</dd></div>`).join("")}</dl></div></details>
      </article>`;
    })
    .join("") || '<section class="panel"><h3>No insights match these filters</h3><p class="empty-state">Try broadening the app or priority filter.</p></section>';

  [
    ["#aso-insight-app", "app"],
    ["#aso-insight-priority", "priority"],
    ["#aso-insight-source", "source"],
  ].forEach(([selector, key]) =>
    panel.querySelector(selector)?.addEventListener("change", (event) => {
      insightFilters[key] = event.target.value;
      renderSubTab(panel);
    }),
  );

  panel.querySelectorAll("[data-insight-destination]").forEach((button) =>
    button.addEventListener("click", () => {
      activeSubTab = button.dataset.insightDestination;
      document.querySelectorAll("[data-aso-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.asoTab === activeSubTab));
      renderSubTab(panel);
    }),
  );

  panel.querySelectorAll("[data-insight-action]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.insightId;
      const status = btn.dataset.insightAction;
      btn.disabled = true;
      try {
        const patch = { status, updated_at: new Date().toISOString() };
        if (status === "snoozed") patch.snoozed_until = new Date(Date.now() + 14 * 86400000).toISOString();
        await pgWrite("PATCH", "aso_insights", patch, `id=eq.${id}`);
        renderSubTab(panel);
      } catch (error) {
        btn.disabled = false;
        alert(error.message);
      }
    }),
  );

  panel.querySelectorAll("[data-create-experiment]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const insight = insights.find((item) => item.id === btn.dataset.insightId);
      if (!insight?.app_id) return;
      btn.disabled = true;
      try {
        await pgWrite("POST", "aso_experiments", [
          {
            app_id: insight.app_id,
            title: `Test: ${insight.title}`,
            hypothesis: insight.recommendation,
            change_type: "other",
            country: insight.country ?? "all",
            old_variant: null,
            new_variant: null,
            target_metric: "conversion",
            secondary_metrics: null,
            start_date: null,
            end_date: null,
            status: "planned",
            result: null,
            conclusion: null,
            next_action: null,
            asset_refs: null,
            notes: `Created from insight: ${insight.rule_id}`,
            updated_at: new Date().toISOString(),
          },
        ]);
        btn.textContent = "Draft created";
      } catch (error) {
        btn.disabled = false;
        alert(error.message);
      }
    }),
  );
}

// ── Experiments ──────────────────────────────────────────────────────────

const EXPERIMENT_STATUSES = ["planned", "running", "monitoring", "won", "lost", "inconclusive", "reverted"];
const TARGET_METRICS = ["conversion", "downloads", "page_views", "impressions"];
const CHANGE_TYPES = [
  "icon",
  "first_screenshot",
  "screenshots",
  "screenshots_reordered",
  "title",
  "subtitle",
  "keyword_field",
  "description",
  "pricing",
  "localisation_launched",
  "monetisation",
  "other",
];

let openExperimentId = null;
let experimentFormOpen = false;
let experimentFilters = { app: "all", status: "active" };

async function renderExperiments(panel) {
  const [experiments, apps] = await Promise.all([
    pg("aso_experiments", "select=*&order=created_at.desc"),
    pg("aso_apps", "select=*"),
  ]);

  if (apps.length === 0) {
    panel.innerHTML = `<section class="panel"><h3>Add an app first</h3><p class="empty-state">Experiments are logged per app.</p></section>`;
    return;
  }

  const order = { running: 0, monitoring: 1, planned: 2, won: 3, lost: 4, inconclusive: 5, reverted: 6 };
  const sorted = [...experiments].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  const visibleExperiments = sorted.filter((experiment) => {
    if (experimentFilters.app !== "all" && experiment.app_id !== experimentFilters.app) return false;
    if (experimentFilters.status === "active") return ["running", "monitoring", "planned"].includes(experiment.status);
    if (experimentFilters.status === "closed") return ["won", "lost", "inconclusive", "reverted"].includes(experiment.status);
    return experimentFilters.status === "all" || experiment.status === experimentFilters.status;
  });

  const open = openExperimentId ? experiments.find((e) => e.id === openExperimentId) : null;
  const liveCount = experiments.filter((experiment) => ["running", "monitoring"].includes(experiment.status)).length;
  const plannedCount = experiments.filter((experiment) => experiment.status === "planned").length;
  const readyCount = experiments.filter((experiment) => ["won", "lost", "inconclusive"].includes(experiment.decision_recommendation)).length;
  const activeQueue = sorted.filter((experiment) => (experimentFilters.app === "all" || experiment.app_id === experimentFilters.app) && ["running", "monitoring"].includes(experiment.status));
  const reviewDate = (experiment) => {
    if (!experiment.start_date) return null;
    const days = experiment.evaluation_days ?? 14;
    return addDays(experiment.start_date, days);
  };

  panel.innerHTML = `
    <div class="mini-stat-grid aso-workflow-summary">
      <article><span>Total experiments</span><strong>${experiments.length}</strong></article>
      <article><span>Live or monitoring</span><strong class="up">${liveCount}</strong></article>
      <article><span>Planned</span><strong>${plannedCount}</strong></article>
      <article><span>Decision recorded</span><strong>${readyCount}</strong></article>
    </div>
    <section class="panel aso-experiment-queue">
      <div class="panel-head"><h3>Active experiment queue</h3><span>${activeQueue.length ? `${activeQueue.length} to monitor` : "nothing live"}</span></div>
      ${activeQueue.length ? activeQueue.map((experiment) => { const app = apps.find((item) => item.id === experiment.app_id); const due = reviewDate(experiment); const reviewState = due && due <= toDateStr(new Date()) ? "Review now" : due ? `Review ${due}` : "Set a start date"; return `<button type="button" class="aso-experiment-queue-row" data-open-experiment="${experiment.id}"><span><strong>${escapeHtml(experiment.title)}</strong><small>${escapeHtml(app?.name ?? "Unknown app")} · ${escapeHtml(experiment.target_metric.replaceAll("_", " "))}</small></span><span class="${reviewState === "Review now" ? "status-partial" : "muted"}">${reviewState}</span></button>`; }).join("") : '<p class="empty-state">No experiments are running. Turn a high-confidence insight into one focused test when the evidence supports a listing change.</p>'}
    </section>
    <section class="panel aso-experiment-form" id="aso-experiment-form" ${experimentFormOpen ? "" : "hidden"}>
      <div class="panel-head"><h3>Log a new experiment</h3><button type="button" class="aso-link-button" data-close-experiment-form>Close</button></div>
      <label class="aso-field">
        <span>App</span>
        <select id="aso-exp-app">${apps.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("")}</select>
      </label>
      <label class="aso-field">
        <span>Title</span>
        <input id="aso-exp-title" type="text" placeholder="e.g. Bolder first screenshot (US)" />
      </label>
      <label class="aso-field">
        <span>Hypothesis</span>
        <input id="aso-exp-hypothesis" type="text" placeholder="What do you expect to change, and why?" />
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Change type</span>
        <select id="aso-exp-change-type">${CHANGE_TYPES.map((t) => `<option value="${t}">${t.replaceAll("_", " ")}</option>`).join("")}</select>
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Market</span>
        <input id="aso-exp-country" type="text" value="all" />
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Target metric</span>
        <select id="aso-exp-target-metric">${TARGET_METRICS.map((metric) => `<option value="${metric}">${metric.replaceAll("_", " ")}</option>`).join("")}</select>
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Success threshold <span id="aso-exp-threshold-unit">pp</span></span>
        <input id="aso-exp-threshold" type="number" min="0" step="0.1" value="1" />
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Evaluation window</span>
        <select id="aso-exp-evaluation-days"><option value="14">14 days</option><option value="21">21 days</option><option value="28">28 days</option></select>
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Start date (blank = planned)</span>
        <input id="aso-exp-start" type="date" />
      </label>
      <button type="button" id="aso-exp-submit">Create experiment</button>
      <p id="aso-exp-status" class="empty-state" hidden></p>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Experiment archive</h3><div class="aso-panel-actions"><span>${visibleExperiments.length}/${experiments.length} shown</span><button type="button" class="aso-action-primary" data-open-experiment-form>Log experiment</button></div></div>
      <div class="aso-filter-toolbar"><select id="aso-experiment-app"><option value="all">All apps</option>${apps.map((app) => `<option value="${app.id}" ${experimentFilters.app === app.id ? "selected" : ""}>${escapeHtml(app.name)}</option>`).join("")}</select><select id="aso-experiment-status"><option value="active" ${experimentFilters.status === "active" ? "selected" : ""}>Active queue</option><option value="running" ${experimentFilters.status === "running" ? "selected" : ""}>Running</option><option value="monitoring" ${experimentFilters.status === "monitoring" ? "selected" : ""}>Monitoring</option><option value="planned" ${experimentFilters.status === "planned" ? "selected" : ""}>Planned</option><option value="closed" ${experimentFilters.status === "closed" ? "selected" : ""}>Closed</option><option value="all" ${experimentFilters.status === "all" ? "selected" : ""}>All statuses</option></select></div>
      ${
        visibleExperiments.length === 0
          ? `<p class="empty-state">No experiments logged yet — every icon, screenshot or metadata change is worth logging below.</p>`
          : `<table class="aso-table">
              <thead><tr><th>Title</th><th>App</th><th>Change</th><th>Market</th><th>Kopa</th><th>Status</th><th>Started</th></tr></thead>
              <tbody>
                ${visibleExperiments
                  .map((e) => {
                    const app = apps.find((a) => a.id === e.app_id);
                    return `<tr class="aso-row-link" data-open-experiment="${e.id}">
                      <td>${escapeHtml(e.title)}</td>
                      <td class="mono">${escapeHtml(app?.name.split(" ")[0] ?? "—")}</td>
                      <td class="mono">${escapeHtml(e.change_type.replaceAll("_", " "))}</td>
                      <td class="mono">${e.country.toUpperCase()}</td>
                      <td class="mono">${escapeHtml(e.decision_recommendation ?? "-")}</td>
                      <td class="mono status-${e.status === "won" ? "ok" : e.status === "lost" ? "failed" : "partial"}">${e.status}</td>
                      <td class="mono">${e.start_date ?? "—"}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>`
      }
    </section>
    ${open ? renderExperimentDetailHtml(open, apps) : ""}
  `;

  panel.querySelectorAll("[data-open-experiment]").forEach((row) =>
    row.addEventListener("click", () => {
      openExperimentId = openExperimentId === row.dataset.openExperiment ? null : row.dataset.openExperiment;
      renderSubTab(panel);
    }),
  );

  if (open) wireExperimentDetailForm(panel, open);
  panel.querySelector("[data-open-experiment-form]")?.addEventListener("click", () => {
    experimentFormOpen = true;
    openExperimentId = null;
    renderSubTab(panel);
  });
  panel.querySelector("[data-close-experiment-form]")?.addEventListener("click", () => {
    experimentFormOpen = false;
    renderSubTab(panel);
  });
  [
    ["#aso-experiment-app", "app"],
    ["#aso-experiment-status", "status"],
  ].forEach(([selector, key]) =>
    panel.querySelector(selector)?.addEventListener("change", (event) => {
      experimentFilters[key] = event.target.value;
      renderSubTab(panel);
    }),
  );

  panel.querySelector("#aso-exp-target-metric")?.addEventListener("change", (event) => {
    const conversion = event.target.value === "conversion";
    panel.querySelector("#aso-exp-threshold").value = conversion ? "1" : "10";
    panel.querySelector("#aso-exp-threshold-unit").textContent = conversion ? "pp" : "%";
  });

  panel.querySelector("#aso-exp-submit")?.addEventListener("click", async () => {
    const submit = panel.querySelector("#aso-exp-submit");
    const status = panel.querySelector("#aso-exp-status");
    status.hidden = false;
    const title = panel.querySelector("#aso-exp-title").value.trim();
    if (!title) {
      status.textContent = "Title is required.";
      return;
    }
    submit.disabled = true;
    status.textContent = "Saving…";
    try {
      const startDate = panel.querySelector("#aso-exp-start").value || null;
      const targetMetric = panel.querySelector("#aso-exp-target-metric").value;
      await pgWrite("POST", "aso_experiments", [
        {
          app_id: panel.querySelector("#aso-exp-app").value,
          title,
          hypothesis: panel.querySelector("#aso-exp-hypothesis").value.trim() || null,
          change_type: panel.querySelector("#aso-exp-change-type").value,
          country: panel.querySelector("#aso-exp-country").value.trim().toLowerCase() || "all",
          old_variant: null,
          new_variant: null,
          target_metric: targetMetric,
          secondary_metrics: null,
          evaluation_days: Number(panel.querySelector("#aso-exp-evaluation-days").value),
          success_threshold: Number(panel.querySelector("#aso-exp-threshold").value),
          success_threshold_unit: targetMetric === "conversion" ? "percentage_points" : "percent",
          decision_recommendation: null,
          recommended_at: null,
          start_date: startDate,
          end_date: null,
          status: startDate ? "running" : "planned",
          result: null,
          conclusion: null,
          next_action: null,
          asset_refs: null,
          notes: null,
          updated_at: new Date().toISOString(),
        },
      ]);
      status.textContent = "Experiment created.";
      experimentFormOpen = false;
      setTimeout(() => renderSubTab(panel), 800);
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
}

function renderExperimentDetailHtml(exp, apps) {
  const app = apps.find((a) => a.id === exp.app_id);
  const evaluationDays = exp.evaluation_days ?? 14;
  const thresholdUnit = exp.success_threshold_unit === "percentage_points" ? "pp" : "%";
  const threshold = exp.success_threshold ?? (thresholdUnit === "pp" ? 1 : 10);
  return `
    <section class="panel aso-insight">
      <div class="panel-head"><h3>${escapeHtml(exp.title)}</h3><span>${escapeHtml(app?.name ?? "")}</span></div>
      <p class="muted">${escapeHtml(exp.hypothesis ?? "No hypothesis recorded.")}</p>
      <p class="empty-state">Target: ${escapeHtml(exp.target_metric.replaceAll("_", " "))}; threshold: ${escapeHtml(threshold)} ${thresholdUnit}; evaluation: ${evaluationDays} days before and after.</p>
      <div id="aso-exp-comparison">
        ${exp.start_date ? '<p class="loading-state">Loading comparison…</p>' : '<p class="empty-state">Set a start date to unlock the automatic before/after comparison.</p>'}
      </div>
      <label class="aso-field">
        <span>Status</span>
        <select id="aso-exp-status-select">
          ${EXPERIMENT_STATUSES.map((s) => `<option value="${s}" ${s === exp.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </label>
      <label class="aso-field">
        <span>Result</span>
        <input id="aso-exp-result" type="text" value="${escapeHtml(exp.result ?? "")}" />
      </label>
      <label class="aso-field">
        <span>Conclusion</span>
        <input id="aso-exp-conclusion" type="text" value="${escapeHtml(exp.conclusion ?? "")}" />
      </label>
      <label class="aso-field">
        <span>Next action</span>
        <input id="aso-exp-next-action" type="text" value="${escapeHtml(exp.next_action ?? "")}" />
      </label>
      <button type="button" id="aso-exp-save-verdict">Save</button>
      <p id="aso-exp-verdict-status" class="empty-state" hidden></p>
    </section>
  `;
}

async function wireExperimentDetailForm(panel, exp) {
  let outcome = null;
  if (exp.start_date) {
    const today = toDateStr(new Date());
    const metrics = await pg(
      "aso_daily_metrics",
      `app_id=eq.${exp.app_id}&date=gte.${addDays(exp.start_date, -60)}&date=lte.${today}&select=*`,
    ).catch(() => []);
    const scoped = exp.country === "all" ? metrics : metrics.filter((m) => m.country === exp.country);
    const evaluationDays = exp.evaluation_days ?? 14;
    const cmp = prePostComparison(scoped, exp.start_date, evaluationDays);
    const box = panel.querySelector("#aso-exp-comparison");
    if (box) {
      outcome = evaluateExperimentOutcome(cmp, exp);
      const targetChange = outcome.target === "conversion" ? formatPp(outcome.change) : formatPct(outcome.change);
      const threshold = `${outcome.threshold}${outcome.unit === "percentage_points" ? " pp" : "%"}`;
      box.innerHTML = !cmp.sufficient
        ? `<p class="empty-state">Not enough metric data on both sides of ${exp.start_date} yet for a ${evaluationDays}-day comparison.</p>`
        : `<div class="metric-grid">
            <article><span>Impressions</span><strong>${formatNumber(cmp.current.impressions)}</strong><small class="${deltaClass(cmp.impressions_pct)}">${formatPct(cmp.impressions_pct)}</small></article>
            <article><span>Downloads</span><strong>${formatNumber(cmp.current.downloads)}</strong><small class="${deltaClass(cmp.downloads_pct)}">${formatPct(cmp.downloads_pct)}</small></article>
            <article><span>Conversion</span><strong>${cmp.current.conversion != null ? formatPct(cmp.current.conversion * 100, 1) : "—"}</strong><small>${formatPp(cmp.conversion_pp)}</small></article>
          </div>
          <p class="empty-state">Kopa recommends <strong>${outcome.recommendation}</strong>: ${escapeHtml(exp.target_metric.replaceAll("_", " "))} moved ${targetChange} against a ${threshold} threshold. This is directional pre/post evidence, not causal proof.</p>`;
    }
  }

  panel.querySelector("#aso-exp-save-verdict")?.addEventListener("click", async () => {
    const btn = panel.querySelector("#aso-exp-save-verdict");
    const status = panel.querySelector("#aso-exp-verdict-status");
    status.hidden = false;
    btn.disabled = true;
    status.textContent = "Saving…";
    try {
      await pgWrite(
        "PATCH",
        "aso_experiments",
        {
          status: panel.querySelector("#aso-exp-status-select").value,
          result: panel.querySelector("#aso-exp-result").value.trim() || null,
          conclusion: panel.querySelector("#aso-exp-conclusion").value.trim() || null,
          next_action: panel.querySelector("#aso-exp-next-action").value.trim() || null,
          decision_recommendation: outcome?.recommendation ?? "awaiting_data",
          recommended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        `id=eq.${exp.id}`,
      );
      status.textContent = "Saved.";
      setTimeout(() => renderSubTab(panel), 600);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });
}

// ── Competitors ──────────────────────────────────────────────────────────

async function renderCompetitors(panel) {
  const [competitors, apps, snapshots, changeEvents, keywords, appKeywords, rankSnapshots] = await Promise.all([
    pg("aso_competitors", "select=*"),
    pg("aso_apps", "select=*"),
    pg("aso_competitor_snapshots", "select=*&order=captured_at.desc"),
    pg("aso_metadata_change_events", "select=*&order=happened_at.desc&limit=50"),
    pg("aso_keywords", "select=*"),
    pg("aso_app_keywords", "select=*"),
    pg("aso_keyword_rank_snapshots", `captured_at=gte.${addDays(toDateStr(new Date()), -35)}&select=*`),
  ]);

  if (apps.length === 0) {
    panel.innerHTML = `<section class="panel"><h3>Add an app first</h3><p class="empty-state">Competitors are tracked per app.</p></section>`;
    return;
  }

  const scopedCompetitors = competitorFilters.app === "all" ? competitors : competitors.filter((competitor) => competitor.app_id === competitorFilters.app);
  const changeTypes = [...new Set(changeEvents.filter((event) => event.competitor_id != null).map((event) => event.change_type))].sort();
  const competitorEvents = changeEvents.filter((event) => {
    const competitor = competitors.find((item) => item.id === event.competitor_id);
    if (!competitor) return false;
    if (competitorFilters.app !== "all" && competitor.app_id !== competitorFilters.app) return false;
    return competitorFilters.change === "all" || event.change_type === competitorFilters.change;
  });
  const timelineEvents = competitorEvents.slice(0, 20);
  const latestRanks = latestSnapshots(rankSnapshots);
  const battles = [];
  for (const competitor of scopedCompetitors) {
    const app = apps.find((item) => item.id === competitor.app_id);
    if (!app) continue;
    for (const link of appKeywords.filter((item) => item.app_id === app.id && item.status !== "paused")) {
      const keyword = keywords.find((item) => item.id === link.keyword_id);
      if (!keyword) continue;
      const owned = latestRanks.get(`${keyword.id}:${app.store_app_id}`);
      const rival = latestRanks.get(`${keyword.id}:${competitor.store_app_id}`);
      if (!owned || !rival || (owned.rank == null && rival.rank == null)) continue;
      battles.push({ competitor, app, keyword, priority: link.priority ?? keyword.priority, ownedRank: owned.rank, rivalRank: rival.rank });
    }
  }
  const battleSummaries = scopedCompetitors
    .map((competitor) => {
      const rows = battles.filter((row) => row.competitor.id === competitor.id);
      const ownerLeads = rows.filter((row) => row.ownedRank != null && (row.rivalRank == null || row.ownedRank < row.rivalRank)).length;
      const rivalLeads = rows.filter((row) => row.rivalRank != null && (row.ownedRank == null || row.rivalRank < row.ownedRank)).length;
      return { competitor, rows, ownerLeads, rivalLeads };
    })
    .filter((summary) => summary.rows.length)
    .sort((a, b) => b.rivalLeads - a.rivalLeads || b.rows.length - a.rows.length);
  const topBattles = [...battles]
    .filter((row) => row.rivalRank != null)
    .sort((a, b) => (b.ownedRank ?? 101) - (b.rivalRank ?? 101) - ((a.ownedRank ?? 101) - (a.rivalRank ?? 101)))
    .slice(0, 20);

  panel.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Competitive landscape</h3><span>${battleSummaries.length} competitor${battleSummaries.length === 1 ? "" : "s"} with shared terms</span></div>
      ${battleSummaries.length ? `<table class="aso-table"><thead><tr><th>Competitor</th><th>Tracked against</th><th>Shared terms</th><th>You lead</th><th>Competitor leads</th></tr></thead><tbody>${battleSummaries.map((summary) => `<tr><td>${escapeHtml(summary.competitor.name)}</td><td class="mono">${escapeHtml(apps.find((app) => app.id === summary.competitor.app_id)?.name.split(" ")[0] ?? "-")}</td><td class="mono">${summary.rows.length}</td><td class="mono"><span class="up">${summary.ownerLeads}</span></td><td class="mono"><span class="down">${summary.rivalLeads}</span></td></tr>`).join("")}</tbody></table>` : '<p class="empty-state">Run a collection after adding competitors and shared keywords to compare their ranks against yours.</p>'}
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Competitor timeline</h3><button type="button" class="aso-action-primary" data-scroll-to="aso-competitor-form">Add competitor</button></div>
      <div class="aso-filter-toolbar"><select id="aso-competitor-app"><option value="all">All apps</option>${apps.map((app) => `<option value="${app.id}" ${competitorFilters.app === app.id ? "selected" : ""}>${escapeHtml(app.name)}</option>`).join("")}</select><select id="aso-competitor-change"><option value="all">All change types</option>${changeTypes.map((type) => `<option value="${escapeHtml(type)}" ${competitorFilters.change === type ? "selected" : ""}>${escapeHtml(type.replaceAll("_", " "))}</option>`).join("")}</select><span>${competitorEvents.length} changes shown</span></div>
      ${
        timelineEvents.length === 0
          ? `<p class="empty-state">No changes detected yet. Once competitors are tracked, each daily collection diffs their public metadata and logs changes here.</p>`
          : timelineEvents
              .map((e) => {
                const comp = competitors.find((c) => c.id === e.competitor_id);
                return `<div class="aso-change-row">
                  <span class="mono">${e.happened_at.slice(0, 10)}</span>
                  <span>${escapeHtml(comp?.name ?? "Unknown")}</span>
                  <span class="muted">${escapeHtml(e.change_type.replaceAll("_", " "))}</span>
                  ${e.old_value || e.new_value ? `<span class="muted">${escapeHtml(e.old_value ?? "—")} → ${escapeHtml(e.new_value ?? "—")}</span>` : ""}
                </div>`;
              })
              .join("")
      }
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Contested terms</h3><span>largest competitor leads first</span></div>
      ${
        topBattles.length
          ? `<table class="aso-table">
              <thead><tr><th>Term</th><th>Market</th><th>Competitor</th><th>Your rank</th><th>Competitor rank</th><th>Priority</th></tr></thead>
              <tbody>${topBattles
                .map((row) => `<tr>
                  <td>${escapeHtml(row.keyword.term)}</td>
                  <td class="mono">${escapeHtml(row.keyword.country.toUpperCase())}</td>
                  <td>${escapeHtml(row.competitor.name)}</td>
                  <td class="mono">${formatRank(row.ownedRank)}</td>
                  <td class="mono">${formatRank(row.rivalRank)}</td>
                  <td class="mono">${escapeHtml(row.priority)}</td>
                </tr>`)
                .join("")}</tbody>
            </table>`
          : '<p class="empty-state">No contested rank data yet.</p>'
      }
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Tracked competitors (${scopedCompetitors.length})</h3><span>current public metadata</span></div>
      ${
        scopedCompetitors.length === 0
          ? `<p class="empty-state">No competitors tracked. Add one below by App Store URL or numeric id.</p>`
          : `<table class="aso-table">
              <thead><tr><th>Competitor</th><th>Tracked against</th><th>Rating</th><th>Version</th></tr></thead>
              <tbody>
                ${scopedCompetitors
                  .map((c) => {
                    const app = apps.find((a) => a.id === c.app_id);
                    const latest = snapshots.find((s) => s.competitor_id === c.id);
                    return `<tr>
                      <td>${escapeHtml(c.name)}</td>
                      <td class="mono">${escapeHtml(app?.name.split(" ")[0] ?? "—")}</td>
                      <td class="mono">${latest?.rating != null ? `★ ${latest.rating.toFixed(1)}` : "—"}</td>
                      <td class="mono">${escapeHtml(latest?.current_version ?? "—")}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>`
      }
    </section>
    <section class="panel" id="aso-competitor-form">
      <div class="panel-head"><h3>Add competitor</h3></div>
      <label class="aso-field">
        <span>Track against</span>
        <select id="aso-comp-app">${apps.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("")}</select>
      </label>
      <label class="aso-field">
        <span>App Store URL or numeric id</span>
        <input id="aso-comp-input" type="text" placeholder="https://apps.apple.com/us/app/…/id…" />
      </label>
      <button type="button" id="aso-comp-submit">Track competitor</button>
      <p id="aso-comp-status" class="empty-state" hidden></p>
    </section>
  `;

  panel.querySelectorAll("#aso-comp-input").forEach((input) =>
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        panel.querySelector("#aso-comp-submit").click();
      }
    }),
  );

  wireScrollActions(panel);

  [
    ["#aso-competitor-app", "app"],
    ["#aso-competitor-change", "change"],
  ].forEach(([selector, key]) =>
    panel.querySelector(selector)?.addEventListener("change", (event) => {
      competitorFilters[key] = event.target.value;
      renderSubTab(panel);
    }),
  );

  panel.querySelector("#aso-comp-submit").addEventListener("click", async () => {
    const btn = panel.querySelector("#aso-comp-submit");
    const status = panel.querySelector("#aso-comp-status");
    status.hidden = false;
    const input = panel.querySelector("#aso-comp-input").value.trim();
    const appId = panel.querySelector("#aso-comp-app").value;
    const owner = apps.find((a) => a.id === appId);
    btn.disabled = true;
    status.textContent = "Looking up public metadata…";
    try {
      const { meta } = await callApi("/api/aso/lookup", { input, country: owner?.primary_country ?? "us" });
      await pgUpsert(
        "aso_competitors",
        [
          {
            app_id: appId,
            platform: "ios",
            store_app_id: meta.store_app_id,
            name: meta.name,
            icon_url: meta.icon_url,
            notes: null,
          },
        ],
        "app_id,platform,store_app_id",
      );
      status.textContent = `Tracking ${meta.name}. Run a collection from the Sync tab to capture its first snapshot.`;
      setTimeout(() => renderSubTab(panel), 1000);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });
}

// ── Reviews ─────────────────────────────────────────────────────────────

function reviewTopics(review, classifications) {
  return classifications.find((item) => item.review_id === review.id)?.topics ?? [];
}

async function renderReviews(panel) {
  const today = toDateStr(new Date());
  const [reviews, classifications, apps] = await Promise.all([
    pg("aso_reviews", `reviewed_at=gte.${addDays(today, -90)}&select=*&order=reviewed_at.desc`),
    pg("aso_review_classifications", "select=*&order=classified_at.desc&limit=2000"),
    pg("aso_apps", "select=id,name"),
  ]);
  const recentCutoff = addDays(today, -29);
  const previousCutoff = addDays(today, -59);
  const recent = reviews.filter((review) => review.reviewed_at.slice(0, 10) >= recentCutoff);
  const previous = reviews.filter((review) => review.reviewed_at.slice(0, 10) >= previousCutoff && review.reviewed_at.slice(0, 10) < recentCutoff);
  const topics = [...new Set(reviews.flatMap((review) => reviewTopics(review, classifications)))].sort();
  const countries = [...new Set(reviews.map((review) => review.country).filter(Boolean))].sort();
  const matchesFilters = (review) => {
    if (reviewFilters.app !== "all" && review.app_id !== reviewFilters.app) return false;
    if (reviewFilters.rating !== "all" && String(review.rating) !== reviewFilters.rating) return false;
    if (reviewFilters.country !== "all" && review.country !== reviewFilters.country) return false;
    return reviewFilters.topic === "all" || reviewTopics(review, classifications).includes(reviewFilters.topic);
  };
  const visibleReviews = recent.filter(matchesFilters);
  const visiblePrevious = previous.filter(matchesFilters);
  const average = visibleReviews.length ? visibleReviews.reduce((sum, review) => sum + review.rating, 0) / visibleReviews.length : null;
  const low = visibleReviews.filter((review) => review.rating <= 2);
  const previousLow = visiblePrevious.filter((review) => review.rating <= 2);
  const topicCounts = (source) => {
    const counts = new Map();
    for (const review of source) for (const topic of reviewTopics(review, classifications)) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    return counts;
  };
  const currentTopics = topicCounts(low);
  const previousTopics = topicCounts(previousLow);
  const topTopics = [...currentTopics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  panel.innerHTML = `
    <div class="metric-grid">
      <article><span>Reviews, 30 days</span><strong>${formatNumber(visibleReviews.length)}</strong></article>
      <article><span>Average rating</span><strong>${average != null ? average.toFixed(1) : "-"}</strong></article>
      <article><span>Low ratings</span><strong>${formatNumber(low.length)}</strong></article>
    </div>
    <div class="aso-filter-toolbar"><select id="aso-review-app"><option value="all">All apps</option>${apps.map((app) => `<option value="${app.id}" ${reviewFilters.app === app.id ? "selected" : ""}>${escapeHtml(app.name)}</option>`).join("")}</select><select id="aso-review-rating"><option value="all">All ratings</option>${[1, 2, 3, 4, 5].map((rating) => `<option value="${rating}" ${reviewFilters.rating === String(rating) ? "selected" : ""}>${rating} star${rating === 1 ? "" : "s"}</option>`).join("")}</select><select id="aso-review-country"><option value="all">All countries</option>${countries.map((country) => `<option value="${country}" ${reviewFilters.country === country ? "selected" : ""}>${escapeHtml(country.toUpperCase())}</option>`).join("")}</select><select id="aso-review-topic"><option value="all">All topics</option>${topics.map((topic) => `<option value="${topic}" ${reviewFilters.topic === topic ? "selected" : ""}>${escapeHtml(topic.replaceAll("_", " "))}</option>`).join("")}</select><span>${visibleReviews.length}/${recent.length} shown</span></div>
    <section class="panel">
      <div class="panel-head"><h3>Recurring low-review signals</h3><span>last 30 days</span></div>
      ${
        topTopics.length
          ? `<table class="aso-table"><thead><tr><th>Signal</th><th>Low reviews</th><th>Vs prior 30d</th><th>Share</th><th></th></tr></thead><tbody>${topTopics
              .map(([topic, count]) => { const delta = count - (previousTopics.get(topic) ?? 0); const state = delta > 0 ? "Worsening" : delta < 0 ? "Improving" : "Steady"; return `<tr><td>${escapeHtml(topic.replaceAll("_", " "))}<small class="aso-topic-state ${delta > 0 ? "down" : delta < 0 ? "up" : ""}">${state}</small></td><td class="mono">${count}</td><td class="mono ${delta > 0 ? "down" : delta < 0 ? "up" : ""}">${delta > 0 ? "+" : ""}${delta}</td><td class="mono">${low.length ? formatPct((count / low.length) * 100) : "-"}</td><td><button type="button" class="aso-link-button" data-open-review-topic="${escapeHtml(topic)}">Inspect</button></td></tr>`; })
              .join("")}</tbody></table>`
          : '<p class="empty-state">Topic signals appear once recent written reviews match a recurring issue pattern.</p>'
      }
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Recent reviews</h3><span>public App Store feed</span></div>
      ${
        visibleReviews.length
          ? visibleReviews
              .slice(0, 30)
              .map((review) => {
                const app = apps.find((item) => item.id === review.app_id);
                const reviewTopicList = reviewTopics(review, classifications);
                return `<details class="aso-review"><summary><span>${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} ${escapeHtml(review.title ?? "Untitled review")}</span><span>${escapeHtml(review.country.toUpperCase())} · ${escapeHtml(review.reviewed_at.slice(0, 10))}</span></summary><div>
                  <p>${escapeHtml(review.body)}</p>
                  <div class="aso-insight-meta">
                    ${app ? `<span>${escapeHtml(app.name)}</span>` : ""}
                    ${review.version ? `<span>Version ${escapeHtml(review.version)}</span>` : ""}
                    ${reviewTopicList.map((topic) => `<span>${escapeHtml(topic.replaceAll("_", " "))}</span>`).join("")}
                  </div>
                </div></details>`;
              })
              .join("")
          : '<p class="empty-state">Reviews will appear after the next collection. Kopa reads the most recent public reviews for each tracked app and primary storefront.</p>'
      }
    </section>
  `;
  [
    ["#aso-review-app", "app"],
    ["#aso-review-rating", "rating"],
    ["#aso-review-country", "country"],
    ["#aso-review-topic", "topic"],
  ].forEach(([selector, key]) =>
    panel.querySelector(selector)?.addEventListener("change", (event) => {
      reviewFilters[key] = event.target.value;
      renderSubTab(panel);
    }),
  );
  panel.querySelectorAll("[data-open-review-topic]").forEach((button) =>
    button.addEventListener("click", () => {
      reviewFilters.topic = button.dataset.openReviewTopic;
      renderSubTab(panel);
    }),
  );
}

// ── Sync ─────────────────────────────────────────────────────────────────

async function renderSync(panel) {
  const today = toDateStr(new Date());
  const [runs, errors, apps, appKeywords, snapshots, connections, analyticsStatus, metrics, preferences] = await Promise.all([
    pg("aso_sync_runs", "select=*&order=started_at.desc&limit=20"),
    pg("aso_sync_errors", "select=*&order=created_at.desc&limit=20"),
    pg("aso_apps", "select=id,store_app_id,name"),
    pg("aso_app_keywords", "select=app_id,keyword_id,status"),
    pg("aso_keyword_rank_snapshots", `app_kind=eq.owned&captured_on=gte.${addDays(today, -2)}&select=keyword_id,store_app_id,captured_on`),
    pg("aso_platform_connections", "provider=eq.appstore_connect&select=*&limit=1"),
    callApi("/api/aso/appstore-connect", { action: "analytics_status" }).catch(() => null),
    pg("aso_daily_metrics", `date=gte.${addDays(today, -7)}&select=app_id,date,country,source`),
    pg("aso_alert_preferences", "select=kind,enabled"),
  ]);

  const lastOk = runs.find((r) => r.status === "ok" || r.status === "partial");
  const activeLinks = appKeywords.filter((link) => link.status !== "paused");
  const freshLinks = activeLinks.filter((link) => {
    const app = apps.find((item) => item.id === link.app_id);
    return app && snapshots.some((snapshot) => snapshot.keyword_id === link.keyword_id && snapshot.store_app_id === app.store_app_id);
  });
  const staleCount = activeLinks.length - freshLinks.length;
  const lastRunFailed = runs[0]?.status === "failed";
  const lastOkAge = lastOk ? Date.now() - new Date(lastOk.started_at).getTime() : Infinity;
  const latestDiscoveryDate = metrics.filter((metric) => metric.source === "appstore_connect_discovery").map((metric) => metric.date).sort().at(-1) ?? null;
  const latestDiscoveryAt = latestDiscoveryDate ? `${latestDiscoveryDate}T00:00:00Z` : null;
  const recentDiscovery = metrics.filter((metric) => metric.source === "appstore_connect_discovery" && metric.date >= addDays(today, -3));
  const discoveryApps = new Set(recentDiscovery.map((metric) => metric.app_id));
  const marketsCovered = new Set(recentDiscovery.filter((metric) => metric.country && metric.country !== "all").map((metric) => `${metric.app_id}:${metric.country}`));
  const actionReady = activeLinks.length > 0 && staleCount === 0 && lastOkAge <= 3 * 86400000 && !lastRunFailed;
  const appCoverage = apps.map((app) => {
    const links = activeLinks.filter((link) => link.app_id === app.id);
    const fresh = freshLinks.filter((link) => link.app_id === app.id);
    return { app, links: links.length, fresh: fresh.length, storefront: discoveryApps.has(app.id) };
  });
  const appStoreConnect = connections[0] ?? null;
  const analyticsRequest = analyticsStatus?.requests?.[0] ?? null;
  const analyticsMessage = analyticsRequest?.last_error ?? (analyticsRequest ? `Report request ${analyticsRequest.status}. ${analyticsRequest.last_checked_at ? `Last checked ${analyticsRequest.last_checked_at.slice(0, 16).replace("T", " ")}.` : "Apple can take 1-2 days to generate the first report."}` : "Request the App Store Discovery and Engagement report to measure product-page visits, discovery impressions, sources, and countries.");
  const recentErrors = errors.filter((error) => Date.now() - new Date(error.created_at).getTime() <= 7 * 86400000);
  const recoveryGroups = [
    { kind: "keyword", title: "Keyword checks need attention", tab: "keywords", label: "Review keywords", items: [] },
    { kind: "competitor", title: "Competitor checks need attention", tab: "competitors", label: "Review competitors", items: [] },
    { kind: "app", title: "Storefront metadata checks need attention", tab: "portfolio", label: "Review apps", items: [] },
  ];
  for (const error of recentErrors) {
    const group = recoveryGroups.find((item) => error.item.startsWith(`${item.kind}:`));
    if (group) group.items.push(error);
  }
  const activeRecoveries = recoveryGroups.filter((group) => group.items.length);
  const nextStep = appStoreConnect?.status !== "configured"
    ? { title: "Check App Store Connect", detail: "Confirm that Kopa can read your Apple account before relying on storefront data.", target: "[data-test-appstore-connect]", label: "Test connection" }
    : !analyticsRequest
      ? { title: "Request storefront analytics", detail: "Apple needs a Discovery and Engagement report request before visits, sources, and countries can appear.", target: "[data-provision-analytics]", label: "Request report" }
      : !actionReady
        ? { title: "Refresh collection coverage", detail: staleCount ? `${staleCount} keyword observation${staleCount === 1 ? " is" : "s are"} stale.` : "Run a fresh collection before acting on rank movement.", target: "[data-run-collection]", label: "Run collection" }
        : { title: "Data is ready for review", detail: "Keyword coverage is fresh. Review this week’s action queue before running another manual collection.", target: null, label: null };

  panel.innerHTML = `
    <section class="panel aso-next-step"><div><span>Recommended next step</span><h3>${nextStep.title}</h3><p>${nextStep.detail}</p></div>${nextStep.target ? `<button type="button" class="aso-action-primary" data-recommended-action="${nextStep.target}">${nextStep.label}</button>` : '<span class="status-ok">Ready</span>'}</section>
    <section class="panel aso-data-health">
      <div class="panel-head"><h3>Data health</h3><span class="status-${actionReady ? "ok" : "partial"}">${actionReady ? "action-ready" : "needs attention"}</span></div>
      <div class="aso-health-banner ${actionReady ? "ready" : "attention"}">
        <strong>${actionReady ? "Search visibility is fresh enough to act on." : "Treat ranking conclusions carefully until coverage is refreshed."}</strong>
        <span>${lastRunFailed ? "The most recent collection failed." : lastOk ? `Last successful collection ${timeSince(lastOk.started_at)}.` : "No successful collection recorded yet."}</span>
      </div>
      <div class="mini-stat-grid aso-workflow-summary">
        <article><span>Keyword coverage</span><strong>${activeLinks.length ? `${freshLinks.length}/${activeLinks.length}` : "-"}</strong><small>fresh in 3 days</small></article>
        <article><span>Last collection</span><strong>${timeSince(lastOk?.started_at)}</strong><small>${lastOk?.trigger ?? "no run"}</small></article>
        <article><span>Storefront report</span><strong>${latestDiscoveryAt ? timeSince(latestDiscoveryAt) : "Pending"}</strong><small>${latestDiscoveryAt ? "latest imported day" : "no Discovery data"}</small></article>
        <article><span>Markets covered</span><strong>${marketsCovered.size}</strong><small>${discoveryApps.size}/${apps.length} app(s), last 3 days</small></article>
      </div>
      ${appCoverage.length ? `<div class="aso-health-coverage">${appCoverage.map(({ app, links, fresh, storefront }) => `<div><span>${escapeHtml(app.name)}</span><span class="mono">${links ? `${fresh}/${links} keywords` : "no keywords"}</span><span class="${storefront ? "status-ok" : "muted"}">${storefront ? "storefront data" : "storefront pending"}</span></div>`).join("")}</div>` : ""}
    </section>
    ${activeRecoveries.length ? `<section class="panel aso-recovery-queue"><div class="panel-head"><h3>Recovery queue</h3><span>${recentErrors.length} failed check${recentErrors.length === 1 ? "" : "s"} in 7 days</span></div>${activeRecoveries.map((group) => { const affected = group.items.slice(0, 4).map((error) => error.item.replace(`${group.kind}:`, "").replaceAll(":", " ")).join(" · "); return `<div class="aso-recovery-row"><div><strong>${group.title}</strong><small>${group.items.length} failed check${group.items.length === 1 ? "" : "s"}: ${escapeHtml(affected)}${group.items.length > 4 ? " …" : ""}</small></div><button type="button" class="aso-link-button" data-recovery-tab="${group.tab}">${group.label}</button></div>`; }).join("")}</section>` : ""}
    <section class="panel">
      <div class="panel-head"><h3>App Store Connect</h3><span class="status-${appStoreConnect?.status === "configured" ? "ok" : appStoreConnect?.status === "error" ? "failed" : "partial"}">${appStoreConnect?.status ?? "unconfigured"}</span></div>
      <button type="button" class="aso-run-collection" data-test-appstore-connect>Test connection</button>
      <button type="button" class="aso-link-button" data-sync-sales>Sync sales data</button>
      <p id="aso-appstore-connect-status" class="empty-state">${escapeHtml(appStoreConnect?.last_test_message ?? "No connection configured.")}</p>
      <div class="panel-head"><h3>Storefront analytics</h3><span class="status-${analyticsRequest?.status === "active" ? "ok" : analyticsRequest?.status === "error" ? "failed" : "partial"}">${analyticsRequest?.status ?? "not requested"}</span></div>
      <button type="button" class="aso-link-button" data-provision-analytics>Request report</button>
      <button type="button" class="aso-link-button" data-sync-analytics>Sync storefront data</button>
      <p id="aso-analytics-status" class="empty-state">${escapeHtml(analyticsMessage)}</p>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Insight alert settings</h3><span>controls future insight creation</span></div>
      ${alertSettingsHtml(preferences)}
    </section>
    <details class="panel aso-operations-detail">
      <summary><span>Operational detail</span><span>${runs.length} recent runs${errors.length ? ` · ${errors.length} logged errors` : ""}</span></summary>
      <div>
        <section>
          <div class="panel-head"><h3>Collection coverage</h3><span>${activeLinks.length ? `${freshLinks.length}/${activeLinks.length} keyword-app pairs fresh` : "no active keywords"}</span></div>
          <p class="empty-state">${
            activeLinks.length === 0
              ? "Add keywords to start measuring search visibility."
              : staleCount === 0
                ? "All active keyword observations were refreshed in the last three days."
                : `${staleCount} active keyword-app pair${staleCount === 1 ? " is" : "s are"} missing a fresh observation. Rankings and related insights may be incomplete until the next collection succeeds.`
          }</p>
        </section>
        <section>
          <div class="panel-head"><h3>Collection runs</h3><span>last successful: ${lastOk ? lastOk.started_at.slice(0, 16).replace("T", " ") : "never"}</span></div>
          <button type="button" class="aso-run-collection" data-run-collection>Run collection now</button>
          <p id="aso-run-status" class="empty-state" hidden></p>
          <table class="aso-table"><thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Processed</th><th>OK</th><th>Failed</th></tr></thead><tbody>${runs.map((r) => `<tr><td class="mono">${r.started_at.slice(0, 16).replace("T", " ")}</td><td class="mono">${r.trigger}</td><td class="mono status-${r.status}">${r.status}</td><td class="mono">${r.processed}</td><td class="mono">${r.succeeded}</td><td class="mono">${r.failed || "—"}</td></tr>`).join("")}</tbody></table>
        </section>
        ${errors.length ? `<section><div class="panel-head"><h3>Technical messages</h3><span>latest ${errors.length}</span></div>${errors.map((error) => `<p class="empty-state"><span class="mono">${escapeHtml(error.item)}</span> — ${escapeHtml(error.message)}</p>`).join("")}</section>` : ""}
      </div>
    </details>
  `;

  panel.querySelector("[data-recommended-action]")?.addEventListener("click", (event) => {
    const target = panel.querySelector(event.target.dataset.recommendedAction);
    target?.click();
  });
  wireAlertSettings(panel);
  panel.querySelectorAll("[data-recovery-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      activeSubTab = button.dataset.recoveryTab;
      document.querySelectorAll("[data-aso-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.asoTab === activeSubTab));
      renderSubTab(panel);
    }),
  );

  panel.querySelector("[data-run-collection]").addEventListener("click", async (e) => {
    const btn = e.target;
    const status = panel.querySelector("#aso-run-status");
    btn.disabled = true;
    status.hidden = false;
    status.textContent = "Collecting… this is rate-limited against Apple and may take a couple of minutes.";
    try {
      const result = await callApi("/api/aso/collect");
      status.textContent = result.message;
      setTimeout(() => renderSubTab(panel), 1500);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });

  panel.querySelector("[data-test-appstore-connect]").addEventListener("click", async (e) => {
    const btn = e.target;
    const status = panel.querySelector("#aso-appstore-connect-status");
    btn.disabled = true;
    status.textContent = "Testing connection…";
    try {
      const result = await callApi("/api/aso/appstore-connect", { action: "test" });
      status.textContent = `Connected. ${result.visibleApps} App Store Connect app(s) visible; ${result.mappedApps} tracked app(s) matched.`;
      setTimeout(() => renderSubTab(panel), 1200);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });

  panel.querySelector("[data-sync-sales]").addEventListener("click", async (e) => {
    const btn = e.target;
    const status = panel.querySelector("#aso-appstore-connect-status");
    btn.disabled = true;
    status.textContent = "Syncing daily Sales and Trends data…";
    try {
      const result = await callApi("/api/aso/appstore-connect", { action: "sync_sales" });
      status.textContent = result.message;
      setTimeout(() => renderSubTab(panel), 1200);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });

  panel.querySelector("[data-provision-analytics]").addEventListener("click", async (e) => {
    const btn = e.target;
    const status = panel.querySelector("#aso-analytics-status");
    btn.disabled = true;
    status.textContent = "Requesting Apple Discovery and Engagement analytics…";
    try {
      const result = await callApi("/api/aso/appstore-connect", { action: "provision_analytics" });
      status.textContent = result.message;
      setTimeout(() => renderSubTab(panel), 1500);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });

  panel.querySelector("[data-sync-analytics]").addEventListener("click", async (e) => {
    const btn = e.target;
    const status = panel.querySelector("#aso-analytics-status");
    btn.disabled = true;
    status.textContent = "Downloading Apple storefront analytics…";
    try {
      const result = await callApi("/api/aso/appstore-connect", { action: "sync_analytics" });
      status.textContent = result.message;
      setTimeout(() => renderSubTab(panel), 1500);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });
}

// ── Add app ──────────────────────────────────────────────────────────────

function renderAddAppForm(panel) {
  panel.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Add an owned app</h3><span>public metadata, no credentials needed</span></div>
      <label class="aso-field">
        <span>App Store URL or numeric app id</span>
        <input id="aso-add-input" type="text" placeholder="https://apps.apple.com/us/app/…/id123456789" />
      </label>
      <label class="aso-field aso-field-narrow">
        <span>Primary storefront</span>
        <input id="aso-add-country" type="text" value="us" maxlength="2" />
      </label>
      <button type="button" id="aso-add-submit">Look up &amp; add</button>
      <p id="aso-add-status" class="empty-state" hidden></p>
    </section>
  `;

  // The console dialog is <form method="dialog">, so Enter in a text input
  // would otherwise submit it and close the whole panel.
  panel.querySelectorAll("#aso-add-input, #aso-add-country").forEach((input) =>
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        panel.querySelector("#aso-add-submit").click();
      }
    }),
  );

  panel.querySelector("#aso-add-submit").addEventListener("click", async () => {
    const input = panel.querySelector("#aso-add-input").value.trim();
    const country = panel.querySelector("#aso-add-country").value.trim().toLowerCase() || "us";
    const btn = panel.querySelector("#aso-add-submit");
    const status = panel.querySelector("#aso-add-status");
    status.hidden = false;
    btn.disabled = true;
    status.textContent = "Looking up public metadata…";
    try {
      const { meta } = await callApi("/api/aso/lookup", { input, country });
      const [app] = await pgWrite("POST", "aso_apps", [
        {
          platform: "ios",
          store_app_id: meta.store_app_id,
          bundle_id: meta.bundle_id,
          name: meta.name,
          subtitle: null,
          developer: meta.developer,
          description: meta.description,
          icon_url: meta.icon_url,
          category: meta.category,
          primary_country: country,
          current_version: meta.current_version,
          release_notes: meta.release_notes,
          rating: meta.rating,
          rating_count: meta.rating_count,
          price: meta.price,
          currency: meta.currency,
          store_url: meta.store_url,
          languages: meta.languages,
          screenshot_urls: meta.screenshot_urls,
          last_store_update_at: meta.last_store_update_at,
          source: "public_store",
          updated_at: new Date().toISOString(),
        },
      ]);
      await pgWrite("POST", "aso_app_storefronts", [
        { app_id: app.id, country, is_primary: true, metadata_localised: true, screenshots_localised: true, notes: null },
      ]);
      // No client-side write to aso_metadata_snapshots — that table is
      // collector-only by RLS design (see supabase/aso-security.sql).
      // api/aso/collect.js inserts the first snapshot automatically the
      // first time a collection runs for this app.
      status.textContent = `Added ${meta.name}. Run a collection from the Sync tab to capture the first metadata snapshot and start tracking keywords once you add them.`;
      activeSubTab = "portfolio";
      const root = panel.closest("#dashboard-content, .aso-content") || panel.parentElement;
      root.querySelectorAll("[data-aso-tab]").forEach((b) => b.classList.toggle("active", b.dataset.asoTab === "portfolio"));
      setTimeout(() => renderSubTab(panel), 1200);
    } catch (error) {
      status.textContent = error.message;
      btn.disabled = false;
    }
  });
}

// ── Tab wiring (self-initializing; no inline script needed for CSP) ──────

function initTabs() {
  const analyticsBtn = document.querySelector("#console-tab-analytics");
  const asoBtn = document.querySelector("#console-tab-aso");
  const analyticsContent = document.querySelector("#dashboard-content");
  const asoRoot = document.querySelector("#aso-root");
  const appSelectLabel = document.querySelector("#app-select-label");
  const sectionLabel = document.querySelector("#console-section-label");
  const workspaceTitle = document.querySelector("#console-workspace-title");
  if (!analyticsBtn || !asoBtn || !analyticsContent || !asoRoot) return;

  let mounted = false;

  asoBtn.addEventListener("click", () => {
    asoBtn.classList.add("active");
    analyticsBtn.classList.remove("active");
    analyticsContent.hidden = true;
    asoRoot.hidden = false;
    if (appSelectLabel) appSelectLabel.hidden = true;
    if (sectionLabel) sectionLabel.textContent = "App Store intelligence";
    if (workspaceTitle) workspaceTitle.textContent = "Growth workspace";
    if (!mounted) {
      mounted = true;
      mountAsoTab(asoRoot);
    }
  });

  analyticsBtn.addEventListener("click", () => {
    analyticsBtn.classList.add("active");
    asoBtn.classList.remove("active");
    analyticsContent.hidden = false;
    asoRoot.hidden = true;
    if (appSelectLabel) appSelectLabel.hidden = false;
    if (sectionLabel) sectionLabel.textContent = "Private studio analytics";
    if (workspaceTitle) workspaceTitle.textContent = "Studio pulse";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTabs);
} else {
  initTabs();
}
