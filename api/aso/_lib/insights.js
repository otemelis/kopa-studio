// The insight engine — deterministic, rule-based, no LLM. Ported from
// acros-studio/lib/aso/insights.ts (types stripped only; thresholds and
// logic unchanged, that file is covered by 47 passing vitest tests).
//
// review_topic_surge is omitted in this port — it depends on classify.js
// (review classification), which ships with the deferred Reviews tab.
// rating_deterioration is kept: it only needs raw review ratings/versions.
// experiment_ready, data_collection_failure and the rest are unchanged.

import {
  addDays,
  compareWindows,
  formatNumber,
  formatPct,
  formatPp,
  formatRank,
  prePostComparison,
  rankChange,
} from "./calc.js";

export const SUPPRESSION_DAYS = 14;

function ev(label, value, source) {
  return { label, value, source };
}

const metricSource = (metrics) => (metrics.some((m) => m.source === "demo") ? "demo" : metrics[0]?.source ?? "calculated");

const MIN_WINDOW_IMPRESSIONS = 300;
const MIN_WINDOW_DOWNLOADS = 20;

function discoveryWindow(rows, today, event, sourceType, pageType = null) {
  const matching = rows.filter(
    (row) =>
      row.event.toLowerCase() === event &&
      row.source_type.toLowerCase() === sourceType &&
      (pageType == null || row.page_type.toLowerCase() === pageType),
  );
  const byDate = new Map();
  for (const row of matching) byDate.set(row.date, (byDate.get(row.date) ?? 0) + (row.count ?? 0));
  return compareWindows(
    [...byDate.entries()].map(([date, value]) => ({
      date,
      impressions: event === "impression" ? value : 0,
      page_views: event === "page view" ? value : 0,
      downloads: 0,
    })),
    14,
    today,
  );
}

function trackedRankMovement(keywords, country, today) {
  const changes = keywords
    .filter((entry) => entry.keyword.country === country)
    .map(({ snapshots }) => {
      const last = snapshots[snapshots.length - 1];
      return last ? rankChange(last.rank, snapshotRankNearDaysAgo(snapshots, 7, today)) : null;
    })
    .filter((value) => value != null);
  return changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : null;
}

function ruleSearchDiscoveryFallsDespiteRanks(ctx) {
  const out = [];
  for (const [country, rows] of ctx.storefrontMetricsByCountry ?? []) {
    const cmp = discoveryWindow(rows, ctx.today, "impression", "app store search");
    if (cmp.current.days_with_data < 8 || cmp.previous.days_with_data < 8) continue;
    if (cmp.previous.impressions < 300 || cmp.impressions_pct == null || cmp.impressions_pct > -20) continue;
    const movement = trackedRankMovement(ctx.keywords, country, ctx.today);
    if (movement == null || movement < -1) continue;

    out.push({
      rule_id: "search_discovery_falls_despite_ranks",
      app_id: ctx.app.id,
      keyword_id: null,
      experiment_id: null,
      country,
      title: `${country.toUpperCase()} App Store Search discovery is falling while tracked ranks are stable for ${ctx.app.name}`,
      observation: `App Store Search impressions in ${country.toUpperCase()} fell ${formatPct(cmp.impressions_pct)} over the last 14 days, while tracked keyword ranks moved ${movement > 0 ? `+${movement.toFixed(1)} places on average` : "roughly flat"}.`,
      interpretation: "The change is more consistent with lower search demand or a shift in broader search-result exposure than with a broad tracked-keyword ranking loss. Apple does not expose the exact searches behind this aggregate.",
      recommendation: "Check the highest-priority terms for this market and competitor movement before changing metadata. Focus the next experiment on a closely related search theme or a stronger first screenshot, then compare search discovery again after two weeks.",
      evidence: [
        ev("App Store Search impressions (14d)", `${formatNumber(cmp.current.impressions)} (${formatPct(cmp.impressions_pct)})`, "appstore_connect_discovery"),
        ev("Tracked rank movement (7d)", `${movement > 0 ? "+" : ""}${movement.toFixed(1)} average places`, "calculated"),
        ev("Tracked keywords with rank history", String(ctx.keywords.filter((entry) => entry.keyword.country === country).length), "public_store"),
      ],
      comparison_window: "Last 14 days vs previous 14 days",
      confidence: cmp.previous.impressions >= 1500 ? "medium_high" : "medium",
      impact: "medium",
      effort: "medium",
      priority: "medium",
      dedupe_key: `search_discovery_falls_despite_ranks:${ctx.app.id}:${country}`,
    });
  }
  return out;
}

function ruleRankGainsNoSearchTrafficLift(ctx) {
  const out = [];
  for (const [country, rows] of ctx.storefrontMetricsByCountry ?? []) {
    const cmp = discoveryWindow(rows, ctx.today, "page view", "app store search", "product page");
    if (cmp.current.days_with_data < 8 || cmp.previous.days_with_data < 8 || cmp.previous.page_views < 50) continue;
    const movement = trackedRankMovement(ctx.keywords, country, ctx.today);
    if (movement == null || movement < 3 || cmp.page_views_pct == null || cmp.page_views_pct > 5) continue;

    out.push({
      rule_id: "rank_gains_no_search_traffic_lift",
      app_id: ctx.app.id,
      keyword_id: null,
      experiment_id: null,
      country,
      title: `${country.toUpperCase()} rank gains have not lifted search-led product-page visits for ${ctx.app.name}`,
      observation: `Tracked keyword ranks improved ${movement.toFixed(1)} places on average over 7 days, while App Store Search product-page views changed only ${formatPct(cmp.page_views_pct)} over the last 14 days.`,
      interpretation: "The ranking improvement is real in Kopa's tracked set, but it has not yet translated into broader search-led store traffic. That can mean the gained terms are low-volume, the demand mix changed, or the effect is still too small to surface in aggregate.",
      recommendation: "Treat this as a validation prompt, not a reason to chase rank alone. Log a focused keyword experiment for the strongest term cluster and measure search impressions, product-page views, and installs together for two weeks.",
      evidence: [
        ev("Tracked rank movement (7d)", `+${movement.toFixed(1)} average places`, "calculated"),
        ev("Search product-page views (14d)", `${formatNumber(cmp.current.page_views)} (${formatPct(cmp.page_views_pct)})`, "appstore_connect_discovery"),
        ev("Tracked keywords in market", String(ctx.keywords.filter((entry) => entry.keyword.country === country).length), "public_store"),
      ],
      comparison_window: "Last 14 days vs previous 14 days; ranks over 7 days",
      confidence: cmp.previous.page_views >= 250 ? "medium_high" : "medium",
      impact: "medium",
      effort: "low",
      priority: "medium",
      dedupe_key: `rank_gains_no_search_traffic_lift:${ctx.app.id}:${country}`,
    });
  }
  return out;
}

function ruleVisibilityUpConversionWeak(ctx) {
  const out = [];
  for (const [country, metrics] of ctx.metricsByCountry) {
    const cmp = compareWindows(metrics, 14, ctx.today);
    if (cmp.current.days_with_data < 10 || cmp.previous.days_with_data < 10) continue;
    if (cmp.current.impressions < MIN_WINDOW_IMPRESSIONS) continue;
    if (cmp.impressions_pct == null || cmp.impressions_pct < 20) continue;
    if (cmp.downloads_pct != null && cmp.downloads_pct > cmp.impressions_pct * 0.5) continue;
    const conv = cmp.current.conversion;
    const baseline = ctx.portfolioAvgConversion;
    if (conv == null) continue;
    const belowBaseline = baseline != null && conv < baseline;
    if (!belowBaseline && cmp.conversion_pp != null && cmp.conversion_pp >= 0) continue;

    const src = metricSource(metrics);
    out.push({
      rule_id: "visibility_up_conversion_weak",
      app_id: ctx.app.id,
      keyword_id: null,
      experiment_id: null,
      country,
      title: `Improve ${country.toUpperCase()} product-page conversion for ${ctx.app.name}`,
      observation: `${country.toUpperCase()} impressions grew ${formatPct(cmp.impressions_pct)} over the last 14 days, but downloads moved only ${formatPct(cmp.downloads_pct)} and conversion is ${belowBaseline ? "below the portfolio average" : "flat-to-down"}.`,
      interpretation: "Keyword visibility is improving, so the current bottleneck is likely the store listing rather than discoverability.",
      recommendation: "Test a more direct first screenshot or icon focused on the core value proposition in this market, and log it as an experiment.",
      evidence: [
        ev("Impressions (14d)", `${formatNumber(cmp.current.impressions)} (${formatPct(cmp.impressions_pct)})`, src),
        ev("Page views (14d)", `${formatNumber(cmp.current.page_views)} (${formatPct(cmp.page_views_pct)})`, src),
        ev("Downloads (14d)", `${formatNumber(cmp.current.downloads)} (${formatPct(cmp.downloads_pct)})`, src),
        ev("Conversion change", formatPp(cmp.conversion_pp), "calculated"),
        ...(baseline != null ? [ev("Portfolio avg conversion", formatPct(baseline * 100, 1), "calculated")] : []),
      ],
      comparison_window: "Last 14 days vs previous 14 days",
      confidence: cmp.current.impressions > 2000 ? "medium_high" : "medium",
      impact: "high",
      effort: "medium",
      priority: "high",
      dedupe_key: `visibility_up_conversion_weak:${ctx.app.id}:${country}`,
    });
  }
  return out;
}

function ruleConversionStrongVisibilityWeak(ctx) {
  const out = [];
  const baseline = ctx.portfolioAvgConversion;
  if (baseline == null) return out;
  for (const [country, metrics] of ctx.metricsByCountry) {
    const cmp = compareWindows(metrics, 14, ctx.today);
    if (cmp.current.days_with_data < 10) continue;
    const conv = cmp.current.conversion;
    if (conv == null || conv < baseline * 1.25) continue;
    if (cmp.current.downloads < MIN_WINDOW_DOWNLOADS) continue;
    if (cmp.current.impressions >= MIN_WINDOW_IMPRESSIONS * 4) continue;

    const countryKeywords = ctx.keywords.filter((k) => k.keyword.country === country);
    const ranked = countryKeywords.filter((k) => {
      const last = k.snapshots[k.snapshots.length - 1];
      return last && last.rank != null && last.rank <= 25;
    });
    if (countryKeywords.length >= 3 && ranked.length > countryKeywords.length / 2) continue;

    const src = metricSource(metrics);
    out.push({
      rule_id: "conversion_strong_visibility_weak",
      app_id: ctx.app.id,
      keyword_id: null,
      experiment_id: null,
      country,
      title: `Grow ${country.toUpperCase()} visibility for ${ctx.app.name} — the listing already converts`,
      observation: `Conversion in ${country.toUpperCase()} is ${formatPct(conv * 100, 1)} (portfolio average ${formatPct(baseline * 100, 1)}), but impressions are low (${formatNumber(cmp.current.impressions)} in 14 days) and only ${ranked.length}/${countryKeywords.length} tracked keywords rank in the top 25.`,
      interpretation: "People who see the page install it — the constraint is discoverability, not the listing.",
      recommendation: "Invest in keyword targeting for this market: reinforce high-priority terms in title/subtitle and consider a localised keyword set.",
      evidence: [
        ev("Conversion (14d)", formatPct(conv * 100, 1), "calculated"),
        ev("Portfolio avg conversion", formatPct(baseline * 100, 1), "calculated"),
        ev("Impressions (14d)", formatNumber(cmp.current.impressions), src),
        ev("Keywords in top 25", `${ranked.length} of ${countryKeywords.length}`, "public_store"),
      ],
      comparison_window: "Last 14 days",
      confidence: "medium",
      impact: "high",
      effort: "medium",
      priority: "high",
      dedupe_key: `conversion_strong_visibility_weak:${ctx.app.id}:${country}`,
    });
  }
  return out;
}

const RELEVANT_CHANGE_TYPES = new Set(["title", "subtitle", "keyword_field", "description", "localisation_launched"]);

function daysAgo(dateStr, today) {
  return Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${dateStr}T00:00:00Z`).getTime()) / 86400000);
}

function lastRanked(snapshots) {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].rank != null) return snapshots[i].rank;
    if (snapshots[i].found === false) return null;
  }
  return null;
}

function snapshotRankNearDaysAgo(snapshots, days, today) {
  const cutoff = addDays(today, -days);
  const candidates = snapshots.filter((s) => s.captured_at.slice(0, 10) <= cutoff);
  return candidates.length ? candidates[candidates.length - 1].rank : null;
}

function ruleKeywordRisingAfterChange(ctx) {
  const out = [];
  const changes = ctx.changeEvents.filter((c) => c.app_id === ctx.app.id && RELEVANT_CHANGE_TYPES.has(c.change_type));
  for (const change of changes) {
    const changeDate = change.happened_at.slice(0, 10);
    if (daysAgo(changeDate, ctx.today) > 45 || daysAgo(changeDate, ctx.today) < 5) continue;
    for (const { keyword, priority, snapshots } of ctx.keywords) {
      if (change.country && change.country !== keyword.country) continue;
      const before = snapshots.filter((s) => s.captured_at.slice(0, 10) < changeDate);
      const after = snapshots.filter((s) => s.captured_at.slice(0, 10) >= changeDate);
      if (before.length < 3 || after.length < 4) continue;
      const beforeRank = lastRanked(before);
      const recentAfter = after.slice(-4);
      const afterRanks = recentAfter.map((s) => s.rank).filter((r) => r != null);
      if (beforeRank == null || afterRanks.length < 3) continue;
      const afterAvg = afterRanks.reduce((a, b) => a + b, 0) / afterRanks.length;
      const improvement = beforeRank - afterAvg;
      if (improvement < 5) continue;
      const sustained = afterRanks.every((r) => r < beforeRank);
      if (!sustained) continue;

      out.push({
        rule_id: "keyword_rising_after_change",
        app_id: ctx.app.id,
        keyword_id: keyword.id,
        experiment_id: null,
        country: keyword.country,
        title: `"${keyword.term}" (${keyword.country.toUpperCase()}) is rising after the ${change.change_type} change`,
        observation: `Since the ${change.change_type} change on ${changeDate}, "${keyword.term}" moved from ${formatRank(beforeRank)} to around #${Math.round(afterAvg)}, holding the gain across ${afterRanks.length} collection points.`,
        interpretation: "The metadata change plausibly contributed to the gain, though store-side factors may also play a role.",
        recommendation: "Keep the current metadata for this term and consider applying the same wording to related markets.",
        evidence: [
          ev("Rank before change", formatRank(beforeRank), "public_store"),
          ev("Recent average rank", `#${Math.round(afterAvg)}`, "calculated"),
          ev("Change event", `${change.change_type} on ${changeDate}`, change.origin === "manual" ? "manual" : "public_store"),
          ev("Sustained points", String(afterRanks.length), "public_store"),
        ],
        comparison_window: `Before vs after ${changeDate}`,
        confidence: "medium_high",
        impact: "medium",
        effort: "low",
        priority: "medium",
        dedupe_key: `keyword_rising_after_change:${keyword.id}:${changeDate}`,
      });
    }
  }
  return out;
}

function ruleKeywordDeclinedAfterRemoval(ctx) {
  const out = [];
  const changes = ctx.changeEvents.filter(
    (c) => c.app_id === ctx.app.id && (c.change_type === "title" || c.change_type === "subtitle" || c.change_type === "keyword_field"),
  );
  for (const change of changes) {
    const changeDate = change.happened_at.slice(0, 10);
    if (daysAgo(changeDate, ctx.today) > 45 || daysAgo(changeDate, ctx.today) < 5) continue;
    const removedText = (change.old_value ?? "").toLowerCase();
    const newText = (change.new_value ?? "").toLowerCase();
    for (const { keyword, snapshots } of ctx.keywords) {
      if (change.country && change.country !== keyword.country) continue;
      const term = keyword.term.toLowerCase();
      if (!removedText.includes(term) || newText.includes(term)) continue;
      const before = snapshots.filter((s) => s.captured_at.slice(0, 10) < changeDate);
      const after = snapshots.filter((s) => s.captured_at.slice(0, 10) >= changeDate);
      if (before.length < 3 || after.length < 3) continue;
      const beforeRank = lastRanked(before);
      const afterRank = lastRanked(after);
      const declined = beforeRank != null && (afterRank == null || afterRank - beforeRank >= 8);
      if (!declined) continue;

      out.push({
        rule_id: "keyword_declined_after_removal",
        app_id: ctx.app.id,
        keyword_id: keyword.id,
        experiment_id: null,
        country: keyword.country,
        title: `"${keyword.term}" dropped after being removed from the ${change.change_type}`,
        observation: `"${keyword.term}" (${keyword.country.toUpperCase()}) went from ${formatRank(beforeRank)} to ${formatRank(afterRank)} after the ${change.change_type} change on ${changeDate} removed the term.`,
        interpretation: "Losing metadata coverage for a term usually costs ranking; the timing here matches, though other factors may contribute.",
        recommendation: `If "${keyword.term}" is strategically important (priority: ${priority}), consider restoring it to the ${change.change_type}.`,
        evidence: [
          ev("Rank before removal", formatRank(beforeRank), "public_store"),
          ev("Rank now", formatRank(afterRank), "public_store"),
          ev("Change event", `${change.change_type} on ${changeDate}`, change.origin === "manual" ? "manual" : "public_store"),
          ev("Keyword priority", priority, "manual"),
        ],
        comparison_window: `Before vs after ${changeDate}`,
        confidence: "medium_high",
        impact: priority === "high" ? "high" : "medium",
        effort: "low",
        priority: priority === "high" ? "high" : "medium",
        dedupe_key: `keyword_declined_after_removal:${keyword.id}:${changeDate}`,
      });
    }
  }
  return out;
}

function ruleKeywordOpportunity(ctx) {
  const out = [];
  const title = ctx.app.name.toLowerCase();
  const subtitle = (ctx.app.subtitle ?? "").toLowerCase();
  for (const { keyword, priority, snapshots } of ctx.keywords) {
    if (snapshots.length < 5) continue;
    const last = snapshots[snapshots.length - 1];
    if (last.rank == null || last.rank < 11 || last.rank > 50) continue;
    if (priority === "low") continue;
    const weekAgo = rankChange(last.rank, snapshotRankNearDaysAgo(snapshots, 7, ctx.today));
    if (weekAgo != null && weekAgo < -3) continue;
    const term = keyword.term.toLowerCase();
    const inTitle = title.includes(term);
    const inSubtitle = subtitle.includes(term);
    if (!inTitle && !inSubtitle) continue;

    out.push({
      rule_id: "keyword_opportunity",
      app_id: ctx.app.id,
      keyword_id: keyword.id,
      experiment_id: null,
      country: keyword.country,
      title: `Push "${keyword.term}" (${keyword.country.toUpperCase()}) — ranked ${formatRank(last.rank)} and within reach`,
      observation: `${ctx.app.name} holds ${formatRank(last.rank)} for "${keyword.term}" with ${weekAgo != null && weekAgo > 0 ? `a +${weekAgo} improvement over 7 days` : "a stable trend"}, and the term already appears in the ${inTitle ? "title" : "subtitle"}.`,
      interpretation: "Ranks 11–50 with existing coverage respond best to incremental pushes — conversion improvements or stronger placement of the term.",
      recommendation: "Reinforce the term (earlier in subtitle, or in the first screenshot caption) and watch the next two weeks of snapshots.",
      evidence: [
        ev("Current rank", formatRank(last.rank), "public_store"),
        ev("7-day change", weekAgo != null ? (weekAgo > 0 ? `+${weekAgo}` : String(weekAgo)) : "—", "calculated"),
        ev("Metadata coverage", inTitle ? "In title" : "In subtitle", "public_store"),
        ev("Priority", priority, "manual"),
      ],
      comparison_window: "Last 14 days",
      confidence: "medium",
      impact: priority === "high" ? "high" : "medium",
      effort: "low",
      priority: priority === "high" ? "high" : "medium",
      dedupe_key: `keyword_opportunity:${keyword.id}`,
    });
  }
  return out;
}

function ruleMetadataMismatch(ctx) {
  const out = [];
  const title = ctx.app.name.toLowerCase();
  const subtitle = (ctx.app.subtitle ?? "").toLowerCase();
  const missing = ctx.keywords.filter(({ keyword, priority }) => {
    if (priority !== "high") return false;
    const term = keyword.term.toLowerCase();
    return !title.includes(term) && !subtitle.includes(term);
  });
  if (missing.length === 0) return out;
  const terms = missing.map((m) => `"${m.keyword.term}" (${m.keyword.country.toUpperCase()})`);
  out.push({
    rule_id: "metadata_mismatch",
    app_id: ctx.app.id,
    keyword_id: missing[0].keyword.id,
    experiment_id: null,
    country: null,
    title: `${missing.length} high-priority keyword${missing.length > 1 ? "s are" : " is"} missing from ${ctx.app.name}'s title and subtitle`,
    observation: `${terms.join(", ")} ${missing.length > 1 ? "are" : "is"} tracked as high priority but appear${missing.length > 1 ? "" : "s"} in neither the title nor the subtitle.`,
    interpretation: "Apple weights title and subtitle heavily; high-priority terms outside both usually can't rank competitively.",
    recommendation: `Rework the subtitle to include ${terms[0]}${missing.length > 1 ? " (and review the others)" : ""}, moving lower-value words to the keyword field.`,
    evidence: [
      ev("Missing terms", terms.join(", "), "calculated"),
      ev("Current title", ctx.app.name, "public_store"),
      ev("Current subtitle", ctx.app.subtitle ?? "(none)", "public_store"),
    ],
    comparison_window: "Current metadata",
    confidence: "high",
    impact: "medium",
    effort: "medium",
    priority: "medium",
    dedupe_key: `metadata_mismatch:${ctx.app.id}:${missing.map((m) => m.keyword.id).sort().join(",")}`,
  });
  return out;
}

function ruleStorefrontUnderperformance(ctx) {
  const out = [];
  const stats = [];
  for (const [country, metrics] of ctx.metricsByCountry) {
    const totals = compareWindows(metrics, 28, ctx.today).current;
    if (totals.days_with_data < 20 || totals.page_views < 200) continue;
    if (totals.conversion == null) continue;
    stats.push({ country, conv: totals.conversion, downloads: totals.downloads, src: metricSource(metrics) });
  }
  if (stats.length < 2) return out;
  const best = [...stats].sort((a, b) => b.conv - a.conv)[0];
  for (const s of stats) {
    if (s === best) continue;
    if (s.conv > best.conv * 0.55) continue;
    const storefront = ctx.storefronts.find((sf) => sf.country === s.country);
    const localised = storefront?.metadata_localised && storefront?.screenshots_localised;
    if (localised) continue;
    out.push({
      rule_id: "storefront_underperformance",
      app_id: ctx.app.id,
      keyword_id: null,
      experiment_id: null,
      country: s.country,
      title: `${s.country.toUpperCase()} materially underperforms ${best.country.toUpperCase()} for ${ctx.app.name}`,
      observation: `Over 28 days, ${s.country.toUpperCase()} converts at ${formatPct(s.conv * 100, 1)} vs ${formatPct(best.conv * 100, 1)} in ${best.country.toUpperCase()}, and ${storefront?.metadata_localised ? "screenshots" : "metadata"} for this market ${storefront ? "isn't fully localised" : "has no localisation record"}.`,
      interpretation: "A comparable market converting at roughly half the rate, without full localisation, usually points to a localisation gap rather than product fit.",
      recommendation: `Prioritise localising ${storefront?.metadata_localised ? "screenshots" : "metadata and screenshots"} for ${s.country.toUpperCase()}, then re-check conversion after two weeks.`,
      evidence: [
        ev(`${s.country.toUpperCase()} conversion (28d)`, formatPct(s.conv * 100, 1), "calculated"),
        ev(`${best.country.toUpperCase()} conversion (28d)`, formatPct(best.conv * 100, 1), "calculated"),
        ev("Downloads (28d)", formatNumber(s.downloads), s.src),
        ev(
          "Localisation",
          storefront
            ? `metadata: ${storefront.metadata_localised ? "yes" : "no"}, screenshots: ${storefront.screenshots_localised ? "yes" : "no"}`
            : "not recorded",
          "manual",
        ),
      ],
      comparison_window: "Last 28 days",
      confidence: "medium",
      impact: "medium",
      effort: "medium",
      priority: "medium",
      dedupe_key: `storefront_underperformance:${ctx.app.id}:${s.country}`,
    });
  }
  return out;
}

function ruleRatingDeterioration(ctx) {
  const recentCutoff = addDays(ctx.today, -14);
  const baselineCutoff = addDays(ctx.today, -74);
  const recent = ctx.reviews.filter((r) => r.reviewed_at.slice(0, 10) >= recentCutoff);
  const baseline = ctx.reviews.filter((r) => r.reviewed_at.slice(0, 10) >= baselineCutoff && r.reviewed_at.slice(0, 10) < recentCutoff);
  if (recent.length < 5 || baseline.length < 10) return [];
  const avg = (list) => list.reduce((a, r) => a + r.rating, 0) / list.length;
  const lowShare = (list) => list.filter((r) => r.rating <= 2).length / list.length;
  const recentAvg = avg(recent);
  const baseAvg = avg(baseline);
  const recentLow = lowShare(recent);
  const baseLow = lowShare(baseline);
  if (recentAvg > baseAvg - 0.4 || recentLow < baseLow * 1.5) return [];

  const versions = new Map();
  for (const r of recent.filter((r) => r.rating <= 2 && r.version)) {
    versions.set(r.version, (versions.get(r.version) ?? 0) + 1);
  }
  const topVersion = [...versions.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    {
      rule_id: "rating_deterioration",
      app_id: ctx.app.id,
      keyword_id: null,
      experiment_id: null,
      country: null,
      title: `${ctx.app.name}'s recent rating is deteriorating`,
      observation: `Average rating over the last 14 days is ${recentAvg.toFixed(1)} vs ${baseAvg.toFixed(1)} baseline, with 1–2★ reviews at ${Math.round(recentLow * 100)}% of volume (was ${Math.round(baseLow * 100)}%).${topVersion ? ` ${topVersion[1]} of the recent low reviews mention version ${topVersion[0]}.` : ""}`,
      interpretation: topVersion != null
        ? `The drop coincides with version ${topVersion[0]} — likely a regression or an unpopular change in that release.`
        : "The drop isn't clearly tied to one version; review topics may explain it.",
      recommendation: "Read the recurring topics on the low reviews from this window and prioritise a fix or store communication in the next release.",
      evidence: [
        ev("Avg rating (14d)", recentAvg.toFixed(2), "public_store"),
        ev("Avg rating (baseline 60d)", baseAvg.toFixed(2), "public_store"),
        ev("1–2★ share (14d)", `${Math.round(recentLow * 100)}%`, "calculated"),
        ev("1–2★ share (baseline)", `${Math.round(baseLow * 100)}%`, "calculated"),
        ...(topVersion ? [ev("Most-mentioned version", `${topVersion[0]} (${topVersion[1]} low reviews)`, "public_store")] : []),
      ],
      comparison_window: "Last 14 days vs previous 60 days",
      confidence: recent.length >= 10 ? "medium_high" : "medium",
      impact: "high",
      effort: "medium",
      priority: "high",
      dedupe_key: `rating_deterioration:${ctx.app.id}`,
    },
  ];
}

function ruleExperimentReady(ctx) {
  const out = [];
  for (const exp of ctx.experiments) {
    if (exp.status !== "running" && exp.status !== "monitoring") continue;
    if (!exp.start_date) continue;
    const daysRunning = daysAgo(exp.start_date, ctx.today);
    if (daysRunning < 14) continue;
    const metrics = exp.country === "all" ? [...ctx.metricsByCountry.values()].flat() : ctx.metricsByCountry.get(exp.country) ?? [];
    const cmp = prePostComparison(metrics, exp.start_date, 14);
    if (!cmp.sufficient) continue;
    out.push({
      rule_id: "experiment_ready",
      app_id: ctx.app.id,
      keyword_id: null,
      experiment_id: exp.id,
      country: exp.country === "all" ? null : exp.country,
      title: `Experiment "${exp.title}" is ready for evaluation`,
      observation: `The experiment has run ${daysRunning} days with sufficient data on both sides of the change. 14d before vs after: impressions ${formatPct(cmp.impressions_pct)}, page views ${formatPct(cmp.page_views_pct)}, downloads ${formatPct(cmp.downloads_pct)}, conversion ${formatPp(cmp.conversion_pp)}.`,
      interpretation: "Performance moved after the change, but other factors may also have contributed — judge against the hypothesis, not just the deltas.",
      recommendation: "Review the pre/post comparison on the experiment page and record win, loss, or inconclusive.",
      evidence: [
        ev("Days running", String(daysRunning), "calculated"),
        ev("Downloads Δ (14d pre/post)", formatPct(cmp.downloads_pct), "calculated"),
        ev("Conversion Δ", formatPp(cmp.conversion_pp), "calculated"),
        ev("Target metric", exp.target_metric, "manual"),
      ],
      comparison_window: "14 days before vs 14 days after start",
      confidence: "medium_high",
      impact: "medium",
      effort: "low",
      priority: "medium",
      dedupe_key: `experiment_ready:${exp.id}`,
    });
  }
  return out;
}

function ruleDataCollectionFailure(ctx) {
  const out = [];
  const recentRuns = ctx.recentSyncRuns.slice(0, 10);
  const failed = recentRuns.find((r) => r.status === "failed");
  const lastOk = recentRuns.find((r) => r.status === "ok" || r.status === "partial");
  const staleDays = lastOk ? daysAgo(lastOk.started_at.slice(0, 10), ctx.today) : null;

  let staleKeywords = 0;
  for (const { snapshots } of ctx.keywords) {
    const last = snapshots[snapshots.length - 1];
    if (!last || daysAgo(last.captured_at.slice(0, 10), ctx.today) > 3) staleKeywords += 1;
  }

  if (!failed && (staleDays == null || staleDays <= 2) && staleKeywords === 0) return out;
  if (ctx.keywords.length === 0 && !failed) return out;

  out.push({
    rule_id: "data_collection_failure",
    app_id: ctx.app.id,
    keyword_id: null,
    experiment_id: null,
    country: null,
    title: `Data collection needs attention before trusting ${ctx.app.name}'s numbers`,
    observation: [
      failed ? `The last ${failed.provider} run failed (${failed.error ?? "no error message"}).` : null,
      staleDays != null && staleDays > 2 ? `The last successful collection was ${staleDays} days ago.` : null,
      staleKeywords > 0 ? `${staleKeywords} tracked keyword(s) have no snapshot in the last 3 days.` : null,
    ].filter(Boolean).join(" "),
    interpretation: "Stale or failed collection makes rank and metric conclusions unreliable.",
    recommendation: "Fix the data source (run a manual collection from the Sync tab) before acting on other insights.",
    evidence: [
      ...(failed ? [ev("Failed run", `${failed.provider} at ${failed.started_at.slice(0, 16).replace("T", " ")}`, "calculated")] : []),
      ev("Last successful run", lastOk ? lastOk.started_at.slice(0, 10) : "never", "calculated"),
      ev("Stale keywords", String(staleKeywords), "calculated"),
    ],
    comparison_window: "Last 3 days",
    confidence: "high",
    impact: "medium",
    effort: "low",
    priority: "high",
    dedupe_key: `data_collection_failure:${ctx.app.id}`,
  });
  return out;
}

const RULE_FNS = [
  ruleVisibilityUpConversionWeak,
  ruleConversionStrongVisibilityWeak,
  ruleSearchDiscoveryFallsDespiteRanks,
  ruleRankGainsNoSearchTrafficLift,
  ruleKeywordRisingAfterChange,
  ruleKeywordDeclinedAfterRemoval,
  ruleKeywordOpportunity,
  ruleMetadataMismatch,
  ruleStorefrontUnderperformance,
  ruleRatingDeterioration,
  ruleExperimentReady,
  ruleDataCollectionFailure,
];

export function evaluateRulesForApp(ctx) {
  const drafts = [];
  for (const fn of RULE_FNS) {
    try {
      drafts.push(...fn(ctx));
    } catch {
      // A single broken rule must never take down the whole evaluation.
    }
  }
  return drafts;
}

/**
 * Drop drafts that duplicate an existing insight: same dedupe_key that is
 * still active/snoozed, or completed/dismissed within the suppression
 * window. Returns drafts that should be inserted.
 */
export function filterAgainstExisting(drafts, existing, now = new Date(), suppressionDays = SUPPRESSION_DAYS) {
  const cutoff = new Date(now.getTime() - suppressionDays * 86400000).toISOString();
  const blocked = new Set();
  for (const e of existing) {
    if (e.status === "active") blocked.add(e.dedupe_key);
    else if (e.status === "snoozed" && (!e.snoozed_until || e.snoozed_until > now.toISOString())) blocked.add(e.dedupe_key);
    else if ((e.status === "dismissed" || e.status === "completed") && e.updated_at >= cutoff) blocked.add(e.dedupe_key);
    else if (e.status === "snoozed") blocked.add(e.dedupe_key);
  }
  const seen = new Set();
  return drafts.filter((d) => {
    if (blocked.has(d.dedupe_key) || seen.has(d.dedupe_key)) return false;
    seen.add(d.dedupe_key);
    return true;
  });
}

export function draftToInsertRow(d) {
  const now = new Date().toISOString();
  return { ...d, status: "active", snoozed_until: null, note: null, created_at: now, updated_at: now };
}
