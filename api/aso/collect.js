// GET  /api/aso/collect  (Authorization: Bearer CRON_SECRET) — daily Vercel Cron
// POST /api/aso/collect  (Authorization: Bearer <supabase access token>) — manual run from the console
//
// Scope: owned-app + competitor public metadata refresh and change
// detection, keyword search + rank snapshots (owned apps and competitors),
// then public customer-review collection and the insight rule engine.
//
// Idempotent: metadata/competitor snapshots only insert on checksum change,
// search results upsert one-per-day, rank snapshots insert once per
// keyword/app per run. Safe to re-run the same day.

import { deriveRankFields, toDateStr, compareWindows, addDays } from "./_lib/calc.js";
import { diffMetadata, metadataChecksum } from "./_lib/metadata-diff.js";
import { lookupApp, searchApps } from "./_lib/providers.js";
import { launchAppleWebBrowser, collectAppleWebObservation } from "./_lib/apple-web.js";
import { syncRecentReviews } from "./_lib/appstore-reviews.js";
import { hasSalesReportsConfig, salesSyncMessage, syncDailySalesMetrics } from "./_lib/appstore-sales.js";
import { syncDiscoveryAnalytics } from "./_lib/appstore-analytics.js";
import {
  competitorWinsDedupeKey,
  draftToInsertRow,
  evaluateRulesForApp,
  filterAgainstExisting,
  metadataEvidenceScopeKey,
  metadataMismatchDedupeKey,
  reconcileCompetitorWinsInsights,
  reconcileDataCollectionFailureInsights,
  reconcileMetadataMismatchInsights,
  reconcileMetadataVersionedInsights,
} from "./_lib/insights.js";
import { requireAdmin, serviceClient } from "./_lib/supabase.js";

let collectionInFlight = false;

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "GET") {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      response.status(503).json({ ok: false, error: "CRON_SECRET is not configured." });
      return;
    }
    if (request.headers.authorization !== `Bearer ${secret}`) {
      response.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }
    const db = serviceClient();
    const scope = request.asoCollectionScope ?? request.query?.scope ?? "full";
    const claimed = scope === "full" ? await db.rpc("aso_claim_next_job").catch(() => []) : [];
    const job = claimed?.[0] ?? null;
    const result = await runCollection("cron", scope);
    if (job) {
      await db.update("aso_jobs", { status: result.ok ? "completed" : "failed", progress: 100, completed_at: new Date().toISOString(), error_message: result.ok ? null : result.message, sync_run_id: result.runId ?? null }, `id=eq.${job.id}`).catch(() => undefined);
    }
    response.status(result.ok ? 200 : 500).json(result);
    return;
  }

  if (request.method === "POST") {
    try {
      await requireAdmin(request.headers.authorization);
    } catch (error) {
      response.status(error.status ?? 401).json({ ok: false, error: error.message });
      return;
    }
    const result = await runCollection("manual", "full");
    response.status(result.ok ? 200 : 500).json(result);
    return;
  }

  response.status(405).json({ ok: false, error: "Method not allowed" });
}

export async function runCollection(trigger, scope = "full") {
  if (!["full", "rankings", "maintenance"].includes(scope)) return { ok: false, message: "Invalid collection scope." };
  if (collectionInFlight) return { ok: false, message: "A collection run is already in progress." };
  const db = serviceClient();
  const lockHolder = `${trigger}:${crypto.randomUUID()}`;
  const acquired = await db.rpc("aso_try_acquire_collection_lock", { p_holder: lockHolder });
  if (!acquired) return { ok: false, message: "A collection run is already in progress. Try again in a few minutes." };
  collectionInFlight = true;
  await db.update(
    "aso_sync_runs",
    { finished_at: new Date().toISOString(), status: "failed", error: "Run exceeded its six-minute collection lease; closed by the next collector invocation." },
    `provider=eq.apple_public&status=eq.running&started_at=lt.${new Date(Date.now() - 6 * 60_000).toISOString()}`,
  ).catch(() => undefined);
  const counters = { processed: 0, succeeded: 0, failed: 0, warnings: 0, retries: 0 };
  const errors = [];
  const startedAt = new Date().toISOString();
  let webBrowser = null;

  const [run] = await db.insert("aso_sync_runs", [
    { provider: "apple_public", trigger, started_at: startedAt, status: "running", ...counters },
  ]);

  try {
    const [apps, keywords, appKeywords, competitors] = await Promise.all([
      db.select("aso_apps", "platform=eq.ios&select=*"),
      db.select("aso_keywords", "select=*"),
      db.select("aso_app_keywords", "select=*"),
      db.select("aso_competitors", "platform=eq.ios&select=*"),
    ]);

    if (scope !== "rankings") {
    // ── App metadata + change detection ──────────────────────────────
    for (const app of apps) {
      counters.processed++;
      try {
        const meta = await lookupApp(app.store_app_id, app.primary_country);
        if (!meta) {
          counters.warnings++;
          errors.push({ item: `app:${app.store_app_id}`, message: "Listing is not publicly discoverable yet; metadata refresh deferred." });
          continue;
        }

        await db.update(
          "aso_apps",
          {
            name: meta.name,
            developer: meta.developer,
            description: meta.description,
            icon_url: meta.icon_url,
            category: meta.category,
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
          `id=eq.${app.id}`,
        );

        const fields = {
          name: meta.name,
          subtitle: app.subtitle,
          locale: meta.locale,
          description: meta.description,
          icon_url: meta.icon_url,
          screenshot_urls: meta.screenshot_urls,
          current_version: meta.current_version,
          release_notes: meta.release_notes,
          price: meta.price,
        };
        const checksum = metadataChecksum(fields);
        const [prev] = await db.select(
          "aso_metadata_snapshots",
          `app_id=eq.${app.id}&country=eq.${app.primary_country}&order=captured_at.desc&limit=1`,
        );

        if (!prev || prev.checksum !== checksum) {
          await db.insert("aso_metadata_snapshots", [
            {
              app_id: app.id,
              competitor_id: null,
              country: app.primary_country,
              captured_at: new Date().toISOString(),
              ...fields,
              checksum,
              source: "public_store",
            },
          ]);
          if (prev) {
            const changes = diffMetadata(prev, fields);
            if (changes.length) {
              await db.insert(
                "aso_metadata_change_events",
                changes.map((c) => ({
                  app_id: app.id,
                  competitor_id: null,
                  country: app.primary_country,
                  locale: meta.locale,
                  ...c,
                  happened_at: new Date().toISOString(),
                  note: null,
                  origin: "detected",
                  source: "public_store",
                })),
              );
            }
          }
        }
        counters.succeeded++;
      } catch (error) {
        counters.failed++;
        errors.push({ item: `app:${app.store_app_id}`, message: msg(error) });
      }
    }

    // ── Competitor metadata + change detection ───────────────────────
    for (const comp of competitors) {
      counters.processed++;
      try {
        const owner = apps.find((a) => a.id === comp.app_id);
        const meta = await lookupApp(comp.store_app_id, owner?.primary_country ?? "us");
        if (!meta) {
          counters.warnings++;
          errors.push({ item: `competitor:${comp.store_app_id}`, message: "Listing is not publicly discoverable in this storefront; metadata refresh deferred." });
          continue;
        }

        const fields = {
          name: meta.name,
          subtitle: null, // not available for competitors either
          description: meta.description,
          icon_url: meta.icon_url,
          screenshot_urls: meta.screenshot_urls,
          current_version: meta.current_version,
          release_notes: meta.release_notes,
          price: meta.price,
        };
        const checksum = metadataChecksum(fields);
        const [prev] = await db.select(
          "aso_competitor_snapshots",
          `competitor_id=eq.${comp.id}&order=captured_at.desc&limit=1`,
        );

        if (!prev || prev.checksum !== checksum) {
          await db.insert("aso_competitor_snapshots", [
            {
              competitor_id: comp.id,
              captured_at: new Date().toISOString(),
              name: meta.name,
              subtitle: null,
              developer: meta.developer,
              icon_url: meta.icon_url,
              rating: meta.rating,
              rating_count: meta.rating_count,
              price: meta.price,
              current_version: meta.current_version,
              release_notes: meta.release_notes,
              screenshot_urls: meta.screenshot_urls,
              checksum,
              source: "itunes_catalog",
            },
          ]);
          if (prev) {
            const changes = diffMetadata(
              { ...prev, subtitle: null, description: null },
              { ...fields, description: null },
            );
            if (changes.length) {
              await db.insert(
                "aso_metadata_change_events",
                changes.map((c) => ({
                  app_id: null,
                  competitor_id: comp.id,
                  country: null,
                  locale: meta.locale,
                  ...c,
                  happened_at: new Date().toISOString(),
                  note: null,
                  origin: "detected",
                  source: "public_store",
                })),
              );
            }
          }
        }
        await db.update("aso_competitors", { name: meta.name, icon_url: meta.icon_url }, `id=eq.${comp.id}`);
        counters.succeeded++;
      } catch (error) {
        counters.failed++;
        errors.push({ item: `competitor:${comp.store_app_id}`, message: msg(error) });
      }
    }

    }

    // ── Keyword search + rank snapshots ──────────────────────────────
    //
    // The Apple queue is deliberately rate-limited (~1 request/3.2s). The
    // current Vercel Hobby project has a 60s function limit, so each scheduled
    // slice stays small enough to leave time for browser startup and database
    // writes. Five ranking runs cover up to 60 keywords/day; larger sets rotate
    // fairly rather than being presented as fully refreshed every day.
    const capturedOn = toDateStr(new Date());
    const activeLinks = appKeywords.filter((ak) => ak.status === "active");
    const allTrackedKeywords = keywords.filter((k) => activeLinks.some((ak) => ak.keyword_id === k.id));

    const recentResults = scope === "maintenance" ? [] : await db.select(
      "aso_keyword_search_results",
      `captured_at=gte.${new Date(Date.now() - 45 * 86_400_000).toISOString()}&select=keyword_id,captured_at&order=captured_at.desc&limit=5000`,
    );
    const lastCollectedAt = new Map();
    for (const r of recentResults) {
      if (!lastCollectedAt.has(r.keyword_id)) lastCollectedAt.set(r.keyword_id, r.captured_at);
    }

    const MAX_KEYWORDS_PER_RUN = 12; // Keep each slice within Hobby's 60s function limit; five daily slots cover 60 keywords.
    const trackedKeywords = scope === "maintenance" ? [] : [...allTrackedKeywords]
      .sort((a, b) => (lastCollectedAt.get(a.id) ?? "").localeCompare(lastCollectedAt.get(b.id) ?? "") || a.country.localeCompare(b.country) || a.term.localeCompare(b.term) || a.id.localeCompare(b.id))
      .slice(0, MAX_KEYWORDS_PER_RUN);

    const webSummary = { succeeded: 0, failed: 0, explicit_ads: 0 };
    if (trackedKeywords.length) {
      try {
        webBrowser = await launchAppleWebBrowser();
      } catch (error) {
        counters.warnings++;
        errors.push({ item: "apple_web_search:browser", message: msg(error) });
      }
    }

    for (const keyword of trackedKeywords) {
      counters.processed++;
      const linkedAppIds = activeLinks.filter((ak) => ak.keyword_id === keyword.id).map((ak) => ak.app_id);
      const webPromise = webBrowser
        ? collectAppleWebObservation(webBrowser, keyword.country, keyword.term)
        : Promise.resolve({ status: "failed", depth: 0, positions: {}, explicitAdCount: 0, checksum: null, error: "Chromium runtime was unavailable." });
      let itemSucceeded = false;

      try {
        const results = await searchApps(keyword.term, keyword.country, 100);
        const depth = results.length;
        const checksum = String(results.reduce((h, r) => (h * 31 + (Number(r.store_app_id) % 997)) % 1000000007, 7));
        await db.upsert("aso_keyword_search_results", [{
          keyword_id: keyword.id,
          captured_at: new Date().toISOString(),
          captured_on: capturedOn,
          results: results.slice(0, 100),
          result_depth: depth,
          checksum,
          source: "itunes_catalog",
        }], "keyword_id,captured_on");

        for (const appId of linkedAppIds) {
          const app = apps.find((a) => a.id === appId);
          if (!app) continue;
          const position = results.find((r) => r.store_app_id === app.store_app_id)?.position ?? null;
          const history = await db.select(
            "aso_keyword_rank_snapshots",
            `keyword_id=eq.${keyword.id}&store_app_id=eq.${app.store_app_id}&app_kind=eq.owned&captured_on=lt.${capturedOn}&or=(source.eq.itunes_catalog,source.eq.public_store)&order=captured_at.asc&select=captured_at,rank`,
          );
          const nowIso = new Date().toISOString();
          const derived = deriveRankFields(history, position, nowIso);
          await db.upsert("aso_keyword_rank_snapshots", [{
            keyword_id: keyword.id, store_app_id: app.store_app_id, app_kind: "owned",
            captured_at: nowIso, captured_on: capturedOn,
            collection_key: `itunes:${capturedOn}:owned:${keyword.id}:${app.store_app_id}`,
            rank: position, found: position != null, result_depth: depth, ...derived,
            collection_status: "ok", checksum, source: "itunes_catalog",
          }], "collection_key");
        }

        const seenCompetitors = new Set();
        for (const appId of linkedAppIds) {
          for (const comp of competitors.filter((c) => c.app_id === appId)) {
            if (seenCompetitors.has(comp.store_app_id)) continue;
            seenCompetitors.add(comp.store_app_id);
            const position = results.find((r) => r.store_app_id === comp.store_app_id)?.position ?? null;
            await db.upsert("aso_keyword_rank_snapshots", [{
              keyword_id: keyword.id, store_app_id: comp.store_app_id, app_kind: "competitor",
              captured_at: new Date().toISOString(), captured_on: capturedOn,
              collection_key: `itunes:${capturedOn}:competitor:${keyword.id}:${comp.store_app_id}`,
              rank: position, found: position != null, result_depth: depth,
              previous_rank: null, change_7d: null, change_30d: null, best_rank: null,
              collection_status: "ok", checksum, source: "itunes_catalog",
            }], "collection_key");
          }
        }
        itemSucceeded = true;
      } catch (error) {
        counters.failed++;
        errors.push({ item: `itunes:${keyword.term}:${keyword.country}`, message: msg(error) });
      }

      try {
        const web = await webPromise;
        const capturedAt = new Date().toISOString();
        const webRows = [];
        for (const appId of linkedAppIds) {
          const app = apps.find((a) => a.id === appId);
          if (!app) continue;
          const position = web.positions[String(app.store_app_id)] ?? null;
          webRows.push({
            keyword_id: keyword.id, store_app_id: app.store_app_id, app_kind: "owned",
            captured_at: capturedAt, captured_on: capturedOn,
            collection_key: `web:${capturedOn}:owned:${keyword.id}:${app.store_app_id}`,
            rank: position, found: position != null, result_depth: web.depth,
            previous_rank: null, change_7d: null, change_30d: null, best_rank: null,
            collection_status: web.status, checksum: web.checksum, source: "apple_web_search",
          });
          for (const comp of competitors.filter((item) => item.app_id === appId)) {
            webRows.push({
              keyword_id: keyword.id, store_app_id: comp.store_app_id, app_kind: "competitor",
              captured_at: capturedAt, captured_on: capturedOn,
              collection_key: `web:${capturedOn}:competitor:${keyword.id}:${comp.store_app_id}`,
              rank: web.positions[String(comp.store_app_id)] ?? null,
              found: web.positions[String(comp.store_app_id)] != null, result_depth: web.depth,
              previous_rank: null, change_7d: null, change_30d: null, best_rank: null,
              collection_status: web.status, checksum: web.checksum, source: "apple_web_search",
            });
          }
        }
        await db.upsert("aso_keyword_rank_snapshots", webRows, "collection_key");
        if (web.status === "failed") {
          webSummary.failed++;
          counters.warnings++;
          errors.push({ item: `apple_web:${keyword.term}:${keyword.country}`, message: web.error ?? "Apple web search was unavailable." });
        } else {
          webSummary.succeeded++;
          webSummary.explicit_ads += web.explicitAdCount;
          itemSucceeded = true;
        }
      } catch (error) {
        webSummary.failed++;
        counters.warnings++;
        errors.push({ item: `apple_web:${keyword.term}:${keyword.country}`, message: msg(error) });
      }

      if (itemSucceeded) counters.succeeded++;
    }

    if (scope === "rankings") {
      const status = counters.failed === 0 && counters.warnings === 0 ? "ok" : counters.succeeded > 0 || counters.warnings > 0 ? "partial" : "failed";
      await db.update("aso_sync_runs", {
        finished_at: new Date().toISOString(), status, ...counters,
        summary: { scope, apps: apps.length, competitors: competitors.length, keywords: trackedKeywords.length, keywords_total: allTrackedKeywords.length, itunes_catalog: trackedKeywords.length, apple_web_search: webSummary },
      }, `id=eq.${run.id}`);
      if (errors.length) await db.insert("aso_sync_errors", errors.slice(0, 50).map((error) => ({ run_id: run.id, ...error })));
      return { ok: status !== "failed", message: `Rankings-only collection ${status}: ${counters.succeeded}/${counters.processed} terms had an observed source result; iTunes ${trackedKeywords.length}, Apple web ${webSummary.succeeded}/${trackedKeywords.length}; ${trackedKeywords.length}/${allTrackedKeywords.length} terms in this sweep.`, runId: run.id };
    }

    // ── Public customer reviews ───────────────────────────────────────
    let reviews = { state: "not_run", imported: 0 };
    try {
      const result = await syncRecentReviews(db, apps);
      reviews = { state: "ok", ...result };
    } catch (error) {
      counters.warnings++;
      reviews = { state: "warning", message: msg(error), imported: 0 };
    }

    // ── First-party daily sales ───────────────────────────────────────
    let sales = { state: "not_configured", imported: 0 };
    if (hasSalesReportsConfig()) {
      try {
        const result = await syncDailySalesMetrics(db, apps);
        sales = { state: "ok", ...result };
        await db.upsert(
          "aso_platform_connections",
          [{ provider: "appstore_connect", status: "configured", last_sync_at: new Date().toISOString(), last_test_ok: true, last_test_message: salesSyncMessage(result), last_test_at: new Date().toISOString() }],
          "provider",
        );
      } catch (error) {
        counters.warnings++;
        sales = { state: "warning", message: msg(error), imported: 0 };
      }
    }

    // Discovery reports are requested deliberately from the console with a
    // temporary Admin key. Once requested, the routine reader key can sync
    // new report segments alongside the daily collection.
    let storefrontAnalytics = { state: "not_requested", imported: 0 };
    const requests = await db.select("aso_analytics_report_requests", "select=id");
    if (requests.length) {
      try {
        const result = await syncDiscoveryAnalytics(db, apps);
        storefrontAnalytics = { state: result.segments ? "ok" : "pending", ...result };
      } catch (error) {
        counters.warnings++;
        storefrontAnalytics = { state: "warning", message: msg(error), imported: 0 };
      }
    }

    // ── Insight engine ────────────────────────────────────────────────
    const created = await runInsightEngine(db);

    const status = counters.failed === 0 && counters.warnings === 0 ? "ok" : counters.succeeded > 0 || counters.warnings > 0 ? "partial" : "failed";
    await db.update(
      "aso_sync_runs",
      {
        finished_at: new Date().toISOString(),
        status,
        ...counters,
        summary: {
          scope,
          apps: apps.length,
          competitors: competitors.length,
          keywords: trackedKeywords.length,
          keywords_total: allTrackedKeywords.length,
          apple_web_search: webSummary,
          insights_created: created,
          reviews,
          sales,
          storefront_analytics: storefrontAnalytics,
        },
      },
      `id=eq.${run.id}`,
    );
    if (errors.length) {
      await db.insert("aso_sync_errors", errors.slice(0, 50).map((e) => ({ run_id: run.id, ...e })));
    }

    const keywordNote =
      allTrackedKeywords.length > trackedKeywords.length
        ? ` Covered ${trackedKeywords.length} of ${allTrackedKeywords.length} keywords this run — the rest will be picked up next run.`
        : "";
    return {
      ok: status !== "failed",
      message: `Collection ${status}: ${counters.succeeded}/${counters.processed} items, ${created} insight(s) created.${keywordNote}`,
      runId: run.id,
    };
  } catch (error) {
    await db
      .update("aso_sync_runs", { finished_at: new Date().toISOString(), status: "failed", error: msg(error), ...counters }, `id=eq.${run.id}`)
      .catch(() => undefined);
    return { ok: false, message: msg(error), runId: run.id };
  } finally {
    await webBrowser?.close().catch(() => undefined);
    collectionInFlight = false;
    await db.rpc("aso_release_collection_lock", { p_holder: lockHolder }).catch(() => undefined);
  }
}

async function runInsightEngine(db) {
  const today = toDateStr(new Date());
  const [apps, storefronts, metadataSnapshots, metrics, storefrontMetrics, appKeywords, keywords, snapshots, competitorRankSnapshots, competitors, changeEvents, reviews, reviewClassifications, experiments, syncRuns, existingInsights, alertPreferences] =
    await Promise.all([
      db.select("aso_apps", "select=*"),
      db.select("aso_app_storefronts", "select=*"),
      db.select("aso_metadata_snapshots", "app_id=not.is.null&select=*"),
      db.select("aso_daily_metrics", `date=gte.${addDays(today, -80)}&select=*`),
      db.select("aso_storefront_metrics", `date=gte.${addDays(today, -40)}&select=app_id,date,country,event,page_type,source_type,count`),
      db.select("aso_app_keywords", "select=*"),
      db.select("aso_keywords", "select=*"),
      db.select("aso_keyword_rank_snapshots", `app_kind=eq.owned&captured_at=gte.${addDays(today, -60)}&select=*`),
      db.select("aso_keyword_rank_snapshots", `app_kind=eq.competitor&captured_at=gte.${addDays(today, -14)}&select=*`),
      db.select("aso_competitors", "select=*"),
      db.select("aso_metadata_change_events", "select=*"),
      db.select("aso_reviews", `reviewed_at=gte.${addDays(today, -80)}&select=*`),
      db.select("aso_review_classifications", "select=*&order=classified_at.desc&limit=2000"),
      db.select("aso_experiments", "select=*"),
      db.select("aso_sync_runs", "order=started_at.desc&limit=20&select=*"),
      db.select("aso_insights", "select=*"),
      db.select("aso_alert_preferences", "select=kind,enabled"),
    ]);

  let pv = 0;
  let dl = 0;
  const cutoff = addDays(today, -13);
  for (const m of metrics) {
    if (m.date < cutoff) continue;
    pv += m.page_views ?? 0;
    dl += m.downloads ?? 0;
  }
  const portfolioAvgConversion = pv > 0 ? dl / pv : null;

  let drafts = [];
  const evaluatedCompetitorScopes = [];
  for (const app of apps) {
    const appCompetitors = competitors.filter((competitor) => competitor.app_id === app.id);
    const appKeywordIds = new Set(
      appKeywords.filter((link) => link.app_id === app.id && link.status !== "paused").map((link) => link.keyword_id),
    );
    evaluatedCompetitorScopes.push(
      ...appCompetitors
        .filter((competitor) =>
          competitorRankSnapshots.some(
            (snapshot) => snapshot.store_app_id === competitor.store_app_id && appKeywordIds.has(snapshot.keyword_id),
          ),
        )
        .map((competitor) => competitorWinsDedupeKey(app.id, competitor.id, null)),
    );
    const metricsByCountry = new Map();
    for (const m of metrics) {
      if (m.app_id !== app.id || m.country === "all") continue;
      if (!metricsByCountry.has(m.country)) metricsByCountry.set(m.country, []);
      metricsByCountry.get(m.country).push(m);
    }
    for (const list of metricsByCountry.values()) list.sort((a, b) => (a.date < b.date ? -1 : 1));

    const storefrontMetricsByCountry = new Map();
    for (const metric of storefrontMetrics) {
      if (metric.app_id !== app.id) continue;
      if (!storefrontMetricsByCountry.has(metric.country)) storefrontMetricsByCountry.set(metric.country, []);
      storefrontMetricsByCountry.get(metric.country).push(metric);
    }

    const ctx = {
      app,
      storefronts: storefronts.filter((sf) => sf.app_id === app.id),
      metadataSnapshots: metadataSnapshots.filter((snapshot) => snapshot.app_id === app.id),
      metricsByCountry,
      storefrontMetricsByCountry,
      competitors: appCompetitors,
      competitorRankSnapshots,
      reviewClassifications,
      keywords: appKeywords
        .filter((link) => link.app_id === app.id && link.status !== "paused")
        .map((link) => {
          const keyword = keywords.find((k) => k.id === link.keyword_id);
          if (!keyword) return null;
          return {
          keyword,
          priority: link.priority ?? keyword.priority,
          snapshots: snapshots
            .filter((sn) => sn.keyword_id === keyword.id && sn.store_app_id === app.store_app_id)
            .sort((a, b) => (a.captured_at < b.captured_at ? -1 : 1)),
          };
        })
        .filter(Boolean),
      changeEvents: changeEvents.filter((c) => c.app_id === app.id),
      reviews: reviews.filter((r) => r.app_id === app.id),
      experiments: experiments.filter((e) => e.app_id === app.id),
      portfolioAvgConversion,
      recentSyncRuns: syncRuns,
      today,
    };
    drafts = drafts.concat(evaluateRulesForApp(ctx));
  }

  const alertKindForRule = (ruleId) => {
    if (ruleId.startsWith("review_")) return "reviews";
    if (ruleId.startsWith("competitor_")) return "competitors";
    if (ruleId.startsWith("experiment_")) return "experiments";
    if (ruleId === "data_collection_failure") return "operations";
    if (ruleId.includes("keyword") || ruleId === "metadata_mismatch") return "keywords";
    return "performance";
  };
  const operationalReconciliation = reconcileDataCollectionFailureInsights(drafts, existingInsights);
  for (const update of operationalReconciliation.updates) {
    await db.update("aso_insights", update.patch, `id=eq.${update.id}`);
  }
  drafts = operationalReconciliation.drafts;
  const evaluatedMetadataEvidenceScopes = appKeywords
    .filter((link) => link.status !== "paused")
    .map((link) => {
      const keyword = keywords.find((item) => item.id === link.keyword_id);
      return keyword ? metadataEvidenceScopeKey(link.app_id, keyword.country, keyword.language) : null;
    })
    .filter(Boolean);
  const metadataVersionReconciliation = reconcileMetadataVersionedInsights(
    drafts,
    existingInsights,
    new Date(),
    evaluatedMetadataEvidenceScopes,
  );
  for (const update of metadataVersionReconciliation.updates) {
    await db.update("aso_insights", update.patch, `id=eq.${update.id}`);
  }
  drafts = metadataVersionReconciliation.drafts;
  const metadataReconciliation = reconcileMetadataMismatchInsights(
    drafts,
    existingInsights,
    new Date(),
    [
      ...apps.map((app) => metadataMismatchDedupeKey(app.id, null, null)),
      ...metadataSnapshots.map((snapshot) => metadataMismatchDedupeKey(snapshot.app_id, snapshot.country, snapshot.locale)),
    ],
  );
  for (const update of metadataReconciliation.updates) {
    await db.update("aso_insights", update.patch, `id=eq.${update.id}`);
  }
  drafts = metadataReconciliation.drafts;
  const competitorReconciliation = reconcileCompetitorWinsInsights(
    drafts,
    existingInsights,
    new Date(),
    evaluatedCompetitorScopes,
  );
  for (const update of competitorReconciliation.updates) {
    await db.update("aso_insights", update.patch, `id=eq.${update.id}`);
  }
  drafts = competitorReconciliation.drafts;
  const enabledAlerts = new Map(alertPreferences.map((preference) => [preference.kind, preference.enabled]));
  drafts = drafts.filter((draft) => enabledAlerts.get(alertKindForRule(draft.rule_id)) !== false);
  drafts = filterAgainstExisting(drafts, existingInsights);
  if (drafts.length) await db.insert("aso_insights", drafts.map(draftToInsertRow));
  return drafts.length;
}

function msg(e) {
  return e instanceof Error ? e.message : String(e);
}
