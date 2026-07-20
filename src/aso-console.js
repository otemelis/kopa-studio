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
let runtimeConfig = null;
let activeSubTab = "portfolio";
let editingKeywordLinkId = null;

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
  renderSubTab(root.querySelector("#aso-panel"));
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
  } catch (error) {
    panel.innerHTML = `<section class="panel"><h3>Could not load this view</h3><p class="empty-state">${escapeHtml(error.message)}</p></section>`;
  }
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
    <section class="panel">
      <div class="panel-head"><h3>Apps</h3><span>tap a row for keywords</span></div>
      <table class="aso-table">
        <thead><tr><th>App</th><th>Version</th><th>Rating</th><th>Downloads 14d</th><th>Conv.</th><th>Keywords</th><th>▲/▼</th><th>Insights</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
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
    <p class="empty-state">Downloads/conversion: last 14 days. Ranks are a public storefront snapshot (iTunes Search), not the exact on-device position.</p>
  `;
}

const ALERT_KINDS = [
  ["performance", "Visibility and conversion"],
  ["keywords", "Keyword movement"],
  ["competitors", "Competitor movement"],
  ["reviews", "Review issues"],
  ["experiments", "Experiment outcomes"],
  ["operations", "Collection health"],
];

async function renderBriefing(panel) {
  const today = toDateStr(new Date());
  const [apps, metrics, insights, changes, reviews, experiments, preferences] = await Promise.all([
    pg("aso_apps", "select=id,name"),
    pg("aso_daily_metrics", `date=gte.${addDays(today, -14)}&select=*`),
    pg("aso_insights", "status=eq.active&select=*&order=created_at.desc"),
    pg("aso_metadata_change_events", `happened_at=gte.${addDays(today, -7)}&select=*&order=happened_at.desc`),
    pg("aso_reviews", `reviewed_at=gte.${addDays(today, -7)}&select=id,rating`),
    pg("aso_experiments", "status=in.(running,monitoring)&select=id,title,decision_recommendation"),
    pg("aso_alert_preferences", "select=kind,enabled"),
  ]);
  const comparison = compareWindows(metrics, 7, today);
  const priorities = { high: 0, medium: 1, low: 2 };
  const alerts = [...insights].sort((a, b) => priorities[a.priority] - priorities[b.priority]).slice(0, 5);
  const highCount = insights.filter((insight) => insight.priority === "high").length;
  const competitorChanges = changes.filter((change) => change.competitor_id != null).length;
  const lowReviews = reviews.filter((review) => review.rating <= 2).length;
  const recommendations = experiments.filter((experiment) => ["winner", "loser", "inconclusive"].includes(experiment.decision_recommendation)).length;
  const preferenceMap = new Map(preferences.map((preference) => [preference.kind, preference.enabled]));
  const lines = [
    `Kopa ASO weekly briefing - ${today}`,
    `Downloads: ${formatNumber(comparison.current.downloads)} (${formatPct(comparison.downloads_pct)})`,
    `Product-page views: ${formatNumber(comparison.current.page_views)} (${formatPct(comparison.page_views_pct)})`,
    `Impressions: ${formatNumber(comparison.current.impressions)} (${formatPct(comparison.impressions_pct)})`,
    `Active high-priority signals: ${highCount}`,
    ...alerts.map((alert) => `- [${alert.priority}] ${alert.title}: ${alert.recommendation}`),
  ];

  panel.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Weekly briefing</h3><span>week ending ${today}</span></div>
      <div class="metric-grid">
        <article><span>Downloads</span><strong>${formatNumber(comparison.current.downloads)}</strong><small class="${deltaClass(comparison.downloads_pct)}">${formatPct(comparison.downloads_pct)}</small></article>
        <article><span>Product-page views</span><strong>${formatNumber(comparison.current.page_views)}</strong><small class="${deltaClass(comparison.page_views_pct)}">${formatPct(comparison.page_views_pct)}</small></article>
        <article><span>Impressions</span><strong>${formatNumber(comparison.current.impressions)}</strong><small class="${deltaClass(comparison.impressions_pct)}">${formatPct(comparison.impressions_pct)}</small></article>
        <article><span>High-priority signals</span><strong>${highCount}</strong><small>${insights.length} active</small></article>
      </div>
      <button type="button" class="aso-link-button" id="aso-copy-briefing">Copy briefing</button>
      <p id="aso-briefing-status" class="empty-state" hidden></p>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Act this week</h3><span>${alerts.length} active signal${alerts.length === 1 ? "" : "s"}</span></div>
      ${
        alerts.length
          ? alerts
              .map((alert) => `<div class="aso-change-row"><span class="priority-${alert.priority}">${alert.priority}</span><span>${escapeHtml(alert.title)}</span><span class="muted">${escapeHtml(alert.recommendation)}</span></div>`)
              .join("")
          : '<p class="empty-state">No active signals yet. Kopa will add a briefing item when there is enough evidence to act.</p>'
      }
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Watchlist</h3><span>last 7 days</span></div>
      <div class="aso-evidence">
        <div><dt>Competitor metadata changes</dt><dd>${competitorChanges}</dd></div>
        <div><dt>New low-star reviews</dt><dd>${lowReviews}</dd></div>
        <div><dt>Experiment recommendations</dt><dd>${recommendations}</dd></div>
        <div><dt>Tracked apps</dt><dd>${apps.length}</dd></div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>In-console alerts</h3><span>controls future insight creation</span></div>
      <div class="aso-alert-settings">
        ${ALERT_KINDS.map(([kind, label]) => `<label><input type="checkbox" data-alert-kind="${kind}" ${preferenceMap.get(kind) !== false ? "checked" : ""} /><span>${label}</span></label>`).join("")}
      </div>
    </section>
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

function deltaClass(v) {
  if (v == null) return "";
  return v > 0 ? "up" : v < 0 ? "down" : "";
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

  const formHtml = renderKeywordFormHtml(apps);

  if (keywords.length === 0) {
    panel.innerHTML = `<section class="panel"><h3>No keywords tracked yet</h3><p class="empty-state">Add your first keyword below — each keyword/country pair is collected once per day.</p></section>${formHtml}`;
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

  panel.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Keywords (${rows.length})</h3><span>gaining/declining vs 7 days ago</span></div>
      <table class="aso-table">
        <thead><tr><th>Keyword</th><th>App</th><th>Country</th><th>Rank</th><th>7d</th><th>30d</th><th>Best</th><th>Comp.</th><th>Priority</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
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
            .join("")}
        </tbody>
      </table>
    </section>
    <p class="empty-state">${competitors.length} competitor(s) tracked across the portfolio.</p>
    ${editingRow ? renderKeywordEditHtml(editingRow, groups) : ""}
    ${formHtml}
  `;
  wireKeywordActions(panel, rows);
  if (editingRow) wireKeywordEditForm(panel, editingRow, appKeywords);
  wireKeywordForm(panel);
}

function rankDelta(value) {
  if (value == null || value === 0) return `<span class="mono">${value === 0 ? "0" : "—"}</span>`;
  return `<span class="${value > 0 ? "up" : "down"}">${value > 0 ? "▲" : "▼"}${Math.abs(value)}</span>`;
}

function renderKeywordFormHtml(apps) {
  return `
    <section class="panel">
      <div class="panel-head"><h3>Add keywords</h3><span>one per line, collected once per day per country</span></div>
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
      setTimeout(() => renderSubTab(panel), 1200);
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
}

// ── Insights ─────────────────────────────────────────────────────────────

async function renderInsights(panel) {
  const [insights, apps, keywords] = await Promise.all([
    pg("aso_insights", "status=eq.active&select=*&order=created_at.desc"),
    pg("aso_apps", "select=*"),
    pg("aso_keywords", "select=*"),
  ]);

  if (insights.length === 0) {
    panel.innerHTML = `<section class="panel"><h3>No active insights</h3><p class="empty-state">The rule engine only speaks when it has evidence — thin or stale data stays silent. Run a collection from the Sync tab once you have a few days of data.</p></section>`;
    return;
  }

  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...insights].sort((a, b) => order[a.priority] - order[b.priority]);

  panel.innerHTML = sorted
    .map((i) => {
      const app = apps.find((a) => a.id === i.app_id);
      const keyword = keywords.find((k) => k.id === i.keyword_id);
      return `
      <article class="panel aso-insight">
        <div class="panel-head">
          <h3>${escapeHtml(i.title)}</h3>
          <span class="priority-${i.priority}">${i.priority} priority</span>
        </div>
        <p>${escapeHtml(i.observation)}</p>
        <p class="muted">${escapeHtml(i.interpretation)}</p>
        <p><strong>Recommended action:</strong> ${escapeHtml(i.recommendation)}</p>
        <dl class="aso-evidence">
          ${i.evidence
            .map((e) => `<div><dt>${escapeHtml(e.label)}</dt><dd>${escapeHtml(e.value)}</dd></div>`)
            .join("")}
        </dl>
        <div class="aso-insight-meta">
          <span>Confidence: ${escapeHtml(i.confidence.replace("_", "-"))}</span>
          <span>Impact: ${escapeHtml(i.impact)}</span>
          <span>Effort: ${escapeHtml(i.effort)}</span>
          ${app ? `<span>${escapeHtml(app.name)}</span>` : ""}
          ${keyword ? `<span>"${escapeHtml(keyword.term)}"</span>` : ""}
        </div>
        <div class="aso-insight-actions">
          <button type="button" data-create-experiment data-insight-id="${i.id}">Create experiment draft</button>
          <button type="button" data-insight-action="completed" data-insight-id="${i.id}">Mark done</button>
          <button type="button" data-insight-action="snoozed" data-insight-id="${i.id}">Snooze 14d</button>
          <button type="button" data-insight-action="dismissed" data-insight-id="${i.id}">Dismiss</button>
        </div>
      </article>`;
    })
    .join("");

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

  const open = openExperimentId ? experiments.find((e) => e.id === openExperimentId) : null;

  panel.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h3>Experiments (${experiments.length})</h3><span>tap a row for pre/post analysis</span></div>
      ${
        experiments.length === 0
          ? `<p class="empty-state">No experiments logged yet — every icon, screenshot or metadata change is worth logging below.</p>`
          : `<table class="aso-table">
              <thead><tr><th>Title</th><th>App</th><th>Change</th><th>Market</th><th>Kopa</th><th>Status</th><th>Started</th></tr></thead>
              <tbody>
                ${sorted
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
    <section class="panel">
      <div class="panel-head"><h3>Log a new experiment</h3></div>
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
  `;

  panel.querySelectorAll("[data-open-experiment]").forEach((row) =>
    row.addEventListener("click", () => {
      openExperimentId = openExperimentId === row.dataset.openExperiment ? null : row.dataset.openExperiment;
      renderSubTab(panel);
    }),
  );

  if (open) wireExperimentDetailForm(panel, open);

  panel.querySelector("#aso-exp-target-metric").addEventListener("change", (event) => {
    const conversion = event.target.value === "conversion";
    panel.querySelector("#aso-exp-threshold").value = conversion ? "1" : "10";
    panel.querySelector("#aso-exp-threshold-unit").textContent = conversion ? "pp" : "%";
  });

  panel.querySelector("#aso-exp-submit").addEventListener("click", async () => {
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

  const competitorEvents = changeEvents.filter((e) => e.competitor_id != null);
  const latestRanks = latestSnapshots(rankSnapshots);
  const battles = [];
  for (const competitor of competitors) {
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
  const battleSummaries = competitors
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
      <div class="panel-head"><h3>Competitor change feed</h3><span>detected on each collection run</span></div>
      ${
        competitorEvents.length === 0
          ? `<p class="empty-state">No changes detected yet. Once competitors are tracked, each daily collection diffs their public metadata and logs changes here.</p>`
          : competitorEvents
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
      <div class="panel-head"><h3>Keyword battlefield</h3><span>latest public storefront snapshot</span></div>
      ${
        battleSummaries.length
          ? `<table class="aso-table">
              <thead><tr><th>Competitor</th><th>Tracked against</th><th>Shared terms</th><th>You lead</th><th>Competitor leads</th></tr></thead>
              <tbody>${battleSummaries
                .map((summary) => `<tr>
                  <td>${escapeHtml(summary.competitor.name)}</td>
                  <td class="mono">${escapeHtml(apps.find((app) => app.id === summary.competitor.app_id)?.name.split(" ")[0] ?? "-")}</td>
                  <td class="mono">${summary.rows.length}</td>
                  <td class="mono"><span class="up">${summary.ownerLeads}</span></td>
                  <td class="mono"><span class="down">${summary.rivalLeads}</span></td>
                </tr>`)
                .join("")}</tbody>
            </table>`
          : '<p class="empty-state">Run a collection after adding competitors and shared keywords to compare their ranks against yours.</p>'
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
      <div class="panel-head"><h3>Tracked competitors (${competitors.length})</h3></div>
      ${
        competitors.length === 0
          ? `<p class="empty-state">No competitors tracked. Add one below by App Store URL or numeric id.</p>`
          : `<table class="aso-table">
              <thead><tr><th>Competitor</th><th>Tracked against</th><th>Rating</th><th>Version</th></tr></thead>
              <tbody>
                ${competitors
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
    <section class="panel">
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
  const recent = reviews.filter((review) => review.reviewed_at.slice(0, 10) >= recentCutoff);
  const average = recent.length ? recent.reduce((sum, review) => sum + review.rating, 0) / recent.length : null;
  const low = recent.filter((review) => review.rating <= 2);
  const topics = new Map();
  for (const review of low) {
    for (const topic of reviewTopics(review, classifications)) topics.set(topic, (topics.get(topic) ?? 0) + 1);
  }
  const topTopics = [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  panel.innerHTML = `
    <div class="metric-grid">
      <article><span>Reviews, 30 days</span><strong>${formatNumber(recent.length)}</strong></article>
      <article><span>Average rating</span><strong>${average != null ? average.toFixed(1) : "-"}</strong></article>
      <article><span>Low ratings</span><strong>${formatNumber(low.length)}</strong></article>
    </div>
    <section class="panel">
      <div class="panel-head"><h3>Recurring low-review signals</h3><span>last 30 days</span></div>
      ${
        topTopics.length
          ? `<table class="aso-table"><thead><tr><th>Signal</th><th>Low reviews</th><th>Share</th></tr></thead><tbody>${topTopics
              .map(([topic, count]) => `<tr><td>${escapeHtml(topic.replaceAll("_", " "))}</td><td class="mono">${count}</td><td class="mono">${low.length ? formatPct((count / low.length) * 100) : "-"}</td></tr>`)
              .join("")}</tbody></table>`
          : '<p class="empty-state">Topic signals appear once recent written reviews match a recurring issue pattern.</p>'
      }
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Recent reviews</h3><span>public App Store feed</span></div>
      ${
        reviews.length
          ? reviews
              .slice(0, 30)
              .map((review) => {
                const app = apps.find((item) => item.id === review.app_id);
                const topics = reviewTopics(review, classifications);
                return `<article class="aso-insight">
                  <div class="panel-head"><h3>${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} ${escapeHtml(review.title ?? "Untitled review")}</h3><span>${escapeHtml(review.country.toUpperCase())}</span></div>
                  <p>${escapeHtml(review.body)}</p>
                  <div class="aso-insight-meta">
                    ${app ? `<span>${escapeHtml(app.name)}</span>` : ""}
                    ${review.version ? `<span>Version ${escapeHtml(review.version)}</span>` : ""}
                    <span>${escapeHtml(review.reviewed_at.slice(0, 10))}</span>
                    ${topics.map((topic) => `<span>${escapeHtml(topic.replaceAll("_", " "))}</span>`).join("")}
                  </div>
                </article>`;
              })
              .join("")
          : '<p class="empty-state">Reviews will appear after the next collection. Kopa reads the most recent public reviews for each tracked app and primary storefront.</p>'
      }
    </section>
  `;
}

// ── Sync ─────────────────────────────────────────────────────────────────

async function renderSync(panel) {
  const today = toDateStr(new Date());
  const [runs, errors, apps, appKeywords, snapshots, connections, analyticsStatus] = await Promise.all([
    pg("aso_sync_runs", "select=*&order=started_at.desc&limit=20"),
    pg("aso_sync_errors", "select=*&order=created_at.desc&limit=20"),
    pg("aso_apps", "select=id,store_app_id,name"),
    pg("aso_app_keywords", "select=app_id,keyword_id,status"),
    pg("aso_keyword_rank_snapshots", `app_kind=eq.owned&captured_on=gte.${addDays(today, -2)}&select=keyword_id,store_app_id,captured_on`),
    pg("aso_platform_connections", "provider=eq.appstore_connect&select=*&limit=1"),
    callApi("/api/aso/appstore-connect", { action: "analytics_status" }).catch(() => null),
  ]);

  const lastOk = runs.find((r) => r.status === "ok" || r.status === "partial");
  const activeLinks = appKeywords.filter((link) => link.status !== "paused");
  const freshLinks = activeLinks.filter((link) => {
    const app = apps.find((item) => item.id === link.app_id);
    return app && snapshots.some((snapshot) => snapshot.keyword_id === link.keyword_id && snapshot.store_app_id === app.store_app_id);
  });
  const staleCount = activeLinks.length - freshLinks.length;
  const appStoreConnect = connections[0] ?? null;
  const analyticsRequest = analyticsStatus?.requests?.[0] ?? null;
  const analyticsMessage = analyticsRequest?.last_error ?? (analyticsRequest ? `Report request ${analyticsRequest.status}. ${analyticsRequest.last_checked_at ? `Last checked ${analyticsRequest.last_checked_at.slice(0, 16).replace("T", " ")}.` : "Apple can take 1-2 days to generate the first report."}` : "Request the App Store Discovery and Engagement report to measure product-page visits, discovery impressions, sources, and countries.");

  panel.innerHTML = `
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
      <div class="panel-head"><h3>Data quality</h3><span>${activeLinks.length ? `${freshLinks.length}/${activeLinks.length} keyword-app pairs fresh` : "no active keywords"}</span></div>
      <p class="empty-state">${
        activeLinks.length === 0
          ? "Add keywords to start measuring search visibility."
          : staleCount === 0
            ? "All active keyword observations were refreshed in the last three days."
            : `${staleCount} active keyword-app pair${staleCount === 1 ? " is" : "s are"} missing a fresh observation. Rankings and related insights may be incomplete until the next collection succeeds.`
      }</p>
    </section>
    <section class="panel">
      <div class="panel-head">
        <h3>Collection runs</h3>
        <span>last successful: ${lastOk ? lastOk.started_at.slice(0, 16).replace("T", " ") : "never"}</span>
      </div>
      <button type="button" class="aso-run-collection" data-run-collection>Run collection now</button>
      <p id="aso-run-status" class="empty-state" hidden></p>
      <table class="aso-table">
        <thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Processed</th><th>OK</th><th>Failed</th></tr></thead>
        <tbody>
          ${runs
            .map(
              (r) => `<tr>
                <td class="mono">${r.started_at.slice(0, 16).replace("T", " ")}</td>
                <td class="mono">${r.trigger}</td>
                <td class="mono status-${r.status}">${r.status}</td>
                <td class="mono">${r.processed}</td>
                <td class="mono">${r.succeeded}</td>
                <td class="mono">${r.failed || "—"}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>
    ${
      errors.length
        ? `<section class="panel"><div class="panel-head"><h3>Recent errors</h3></div>${errors
            .map((e) => `<p class="empty-state"><span class="mono">${e.item}</span> — ${escapeHtml(e.message)}</p>`)
            .join("")}</section>`
        : ""
    }
  `;

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
  if (!analyticsBtn || !asoBtn || !analyticsContent || !asoRoot) return;

  let mounted = false;

  asoBtn.addEventListener("click", () => {
    asoBtn.classList.add("active");
    analyticsBtn.classList.remove("active");
    analyticsContent.hidden = true;
    asoRoot.hidden = false;
    if (appSelectLabel) appSelectLabel.hidden = true;
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
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTabs);
} else {
  initTabs();
}
