import assert from "node:assert/strict";
import test from "node:test";

import {
  competitorWinsDedupeKey,
  evaluateRulesForApp,
  metadataEvidenceScopeKey,
  metadataMismatchDedupeKey,
  reconcileCompetitorWinsInsights,
  reconcileDataCollectionFailureInsights,
  reconcileMetadataMismatchInsights,
  reconcileMetadataVersionedInsights,
} from "./insights.js";

const NOW = new Date("2026-07-30T12:00:00.000Z");
const APP_ID = "app-inner-type";
const ENNEAGRAM_ID = "competitor-enneagram";

function draft(overrides = {}) {
  return {
    rule_id: "metadata_mismatch",
    app_id: APP_ID,
    keyword_id: "keyword-current",
    experiment_id: null,
    country: null,
    locale: null,
    title: "71 high-priority keywords are missing",
    observation: "Current missing keyword evidence.",
    interpretation: "Current deterministic diagnosis.",
    recommendation: "Review the current metadata.",
    evidence: [{ label: "Missing terms", value: "71", source: "calculated" }],
    comparison_window: "Current metadata",
    confidence: "high",
    impact: "medium",
    effort: "medium",
    priority: "medium",
    dedupe_key: metadataMismatchDedupeKey(APP_ID, null),
    ...overrides,
  };
}

function row(id, createdAt, overrides = {}) {
  return {
    id,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    snoozed_until: null,
    note: null,
    ...draft(),
    ...overrides,
  };
}

function applyPlan(rows, plan) {
  return rows.map((item) => {
    const update = plan.updates.find((candidate) => candidate.id === item.id);
    return update ? { ...item, ...update.patch } : item;
  });
}

test("metadata mismatch identity is stable across changing keyword evidence", () => {
  assert.equal(metadataMismatchDedupeKey(APP_ID, null), `metadata_mismatch:${APP_ID}:portfolio:unknown`);
  assert.equal(metadataMismatchDedupeKey(APP_ID, "GB", "en-GB"), `metadata_mismatch:${APP_ID}:gb:en-GB`);
  assert.equal(
    draft({ keyword_id: "keyword-a", evidence: [{ label: "Missing terms", value: "49", source: "calculated" }] }).dedupe_key,
    draft({ keyword_id: "keyword-b", evidence: [{ label: "Missing terms", value: "71", source: "calculated" }] }).dedupe_key,
  );
});

test("reconciliation keeps the newest row current and preserves older rows as superseded history", () => {
  const currentDraft = draft();
  const rows = [
    row("oldest", "2026-07-20T10:00:00.000Z", { dedupe_key: "metadata_mismatch:legacy:54" }),
    row("middle", "2026-07-21T10:00:00.000Z", { dedupe_key: "metadata_mismatch:legacy:49" }),
    row("newest", "2026-07-28T10:00:00.000Z", { dedupe_key: "metadata_mismatch:legacy:71" }),
  ];

  const plan = reconcileMetadataMismatchInsights([currentDraft], rows, NOW);
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.updates.length, 3);

  const reconciled = applyPlan(rows, plan);
  assert.equal(reconciled.filter((item) => item.status === "active").length, 1);
  assert.equal(reconciled.find((item) => item.id === "newest").dedupe_key, metadataMismatchDedupeKey(APP_ID, null));
  assert.deepEqual(
    reconciled.filter((item) => item.status === "superseded").map((item) => item.id).sort(),
    ["middle", "oldest"],
  );
  assert.ok(reconciled.filter((item) => item.status === "superseded").every((item) => item.note.includes("Superseded automatically")));
});

test("unchanged reruns are idempotent", () => {
  const currentDraft = draft();
  const rows = [row("current", "2026-07-28T10:00:00.000Z")];

  const first = reconcileMetadataMismatchInsights([currentDraft], rows, NOW);
  assert.deepEqual(first, { drafts: [], updates: [] });

  const second = reconcileMetadataMismatchInsights([currentDraft], applyPlan(rows, first), NOW);
  assert.deepEqual(second, { drafts: [], updates: [] });
});

test("changed evidence refreshes the one current row without inserting a duplicate", () => {
  const rows = [row("current", "2026-07-28T10:00:00.000Z")];
  const changed = draft({
    title: "72 high-priority keywords are missing",
    evidence: [{ label: "Missing terms", value: "72", source: "calculated" }],
  });

  const plan = reconcileMetadataMismatchInsights([changed], rows, NOW);
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, "current");
  assert.equal(plan.updates[0].patch.title, changed.title);
});

test("different app and market scopes do not contaminate each other", () => {
  const rows = [row("other-market", "2026-07-28T10:00:00.000Z", { country: "us", dedupe_key: metadataMismatchDedupeKey(APP_ID, "us") })];
  const gbDraft = draft({ country: "gb", dedupe_key: metadataMismatchDedupeKey(APP_ID, "gb") });

  const plan = reconcileMetadataMismatchInsights(
    [gbDraft],
    rows,
    NOW,
    [metadataMismatchDedupeKey(APP_ID, "gb")],
  );
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.drafts, [gbDraft]);
});

test("metadata recovery supersedes the current portfolio row while preserving its evidence", () => {
  const existing = [row("current", "2026-07-28T10:00:00.000Z")];
  const plan = reconcileMetadataMismatchInsights(
    [],
    existing,
    NOW,
    [metadataMismatchDedupeKey(APP_ID, null)],
  );

  assert.deepEqual(plan.drafts, []);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, "current");
  assert.equal(plan.updates[0].patch.status, "superseded");
  assert.match(plan.updates[0].patch.note, /Resolved automatically/);

  const historical = applyPlan(existing, plan)[0];
  assert.deepEqual(historical.evidence, existing[0].evidence);
  assert.equal(historical.title, existing[0].title);
});

test("metadata recovery applies to every evaluated exact-country and legacy portfolio scope", () => {
  const otherApp = row("other-app", "2026-07-28T10:00:00.000Z", {
    app_id: "app-not-evaluated",
    dedupe_key: metadataMismatchDedupeKey("app-not-evaluated", null),
  });
  const marketScoped = row("market-scoped", "2026-07-28T10:00:00.000Z", {
    country: "gb",
    dedupe_key: metadataMismatchDedupeKey(APP_ID, "gb"),
  });

  const plan = reconcileMetadataMismatchInsights(
    [],
    [otherApp, marketScoped],
    NOW,
    [metadataMismatchDedupeKey(APP_ID, "gb")],
  );
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, "market-scoped");
  assert.equal(plan.updates[0].patch.status, "superseded");
});

test("active metadata mismatches and recovered metadata history are idempotent", () => {
  const currentDraft = draft();
  const active = [row("current", "2026-07-28T10:00:00.000Z")];
  const evaluated = [metadataMismatchDedupeKey(APP_ID, null)];
  assert.deepEqual(reconcileMetadataMismatchInsights([currentDraft], active, NOW, evaluated), { drafts: [], updates: [] });

  const recovered = applyPlan(active, reconcileMetadataMismatchInsights([], active, NOW, evaluated));
  assert.deepEqual(reconcileMetadataMismatchInsights([], recovered, NOW, evaluated), { drafts: [], updates: [] });
});

function ruleContext(overrides = {}) {
  return {
    app: { id: APP_ID, name: "InnerType", subtitle: null },
    storefronts: [],
    metadataSnapshots: [],
    metricsByCountry: new Map(),
    storefrontMetricsByCountry: new Map(),
    competitors: [],
    competitorRankSnapshots: [],
    reviewClassifications: [],
    keywords: [],
    changeEvents: [],
    reviews: [],
    experiments: [],
    portfolioAvgConversion: null,
    recentSyncRuns: [{ status: "ok", started_at: "2026-07-31T08:00:00.000Z" }],
    today: "2026-07-31",
    ...overrides,
  };
}

function metadataSnapshot(overrides = {}) {
  return {
    id: "metadata-us-v2",
    app_id: APP_ID,
    country: "us",
    locale: "en-US",
    captured_at: "2026-07-25T10:00:00.000Z",
    name: "InnerType Personality Test",
    subtitle: "Know yourself",
    current_version: "2.1",
    checksum: "checksum-v2",
    source: "public_store",
    ...overrides,
  };
}

function rankSnapshot(date, rank) {
  return {
    captured_at: `${date}T12:00:00.000Z`,
    rank,
    found: rank != null,
  };
}

test("current metadata keyword opportunities exclude every pre-version rank snapshot", () => {
  const keyword = { id: "keyword-personality", term: "personality test", country: "us", language: "en-US" };
  const oldRanks = [
    rankSnapshot("2026-07-18", 28),
    rankSnapshot("2026-07-19", 26),
    rankSnapshot("2026-07-20", 25),
    rankSnapshot("2026-07-21", 24),
    rankSnapshot("2026-07-22", 23),
  ];
  const fourCurrentRanks = [
    rankSnapshot("2026-07-25", 22),
    rankSnapshot("2026-07-26", 21),
    rankSnapshot("2026-07-27", 20),
    rankSnapshot("2026-07-28", 19),
  ];
  const base = ruleContext({
    metadataSnapshots: [metadataSnapshot()],
    keywords: [{ keyword, priority: "medium", snapshots: [...oldRanks, ...fourCurrentRanks] }],
  });

  assert.equal(
    evaluateRulesForApp(base).filter((item) => item.rule_id === "keyword_opportunity").length,
    0,
    "pre-version ranks must not satisfy the five-snapshot threshold",
  );

  const withFiveCurrentRanks = {
    ...base,
    keywords: [{
      keyword,
      priority: "medium",
      snapshots: [...oldRanks, ...fourCurrentRanks, rankSnapshot("2026-07-29", 18)],
    }],
  };
  const [opportunity] = evaluateRulesForApp(withFiveCurrentRanks)
    .filter((item) => item.rule_id === "keyword_opportunity");
  assert.ok(opportunity);
  assert.match(opportunity.dedupe_key, /metadata-us-v2$/);
  assert.match(
    opportunity.evidence.find((item) => item.label === "Rank evidence under metadata version").value,
    /^2026-07-25/,
  );
  assert.equal(opportunity.evidence.find((item) => item.label === "Metadata snapshot").value, "metadata-us-v2");
  assert.equal(opportunity.evidence.find((item) => item.label === "Metadata version").value, "2.1 · checksum checksum-v2");
});

test("metadata-dependent findings require an exact-country observed snapshot", () => {
  const context = ruleContext({
    metadataSnapshots: [metadataSnapshot()],
    keywords: [
      {
        keyword: { id: "keyword-us", term: "enneagram", country: "us", language: "en-US" },
        priority: "high",
        snapshots: [],
      },
      {
        keyword: { id: "keyword-gb", term: "personality quiz", country: "gb", language: "en-GB" },
        priority: "high",
        snapshots: [
          rankSnapshot("2026-07-25", 25),
          rankSnapshot("2026-07-26", 24),
          rankSnapshot("2026-07-27", 23),
          rankSnapshot("2026-07-28", 22),
          rankSnapshot("2026-07-29", 21),
        ],
      },
    ],
  });

  const metadataFindings = evaluateRulesForApp(context)
    .filter((item) => item.rule_id === "metadata_mismatch" || item.rule_id === "keyword_opportunity");
  assert.equal(metadataFindings.length, 1);
  assert.equal(metadataFindings[0].rule_id, "metadata_mismatch");
  assert.equal(metadataFindings[0].country, "us");
  assert.equal(metadataFindings[0].evidence.find((item) => item.label === "Metadata snapshot").value, "metadata-us-v2");
  assert.match(
    metadataFindings[0].evidence.find((item) => item.label === "Metadata change time").value,
    /No detected change event/,
  );
});

test("change-response findings expose the observed post-change metadata version and change time", () => {
  const changeTime = "2026-07-20T10:00:02.000Z";
  const context = ruleContext({
    metadataSnapshots: [metadataSnapshot({
      id: "metadata-us-change",
      captured_at: "2026-07-20T10:00:00.000Z",
      checksum: "checksum-change",
    })],
    changeEvents: [{
      app_id: APP_ID,
      country: "us",
      locale: "en-US",
      change_type: "subtitle",
      happened_at: changeTime,
      origin: "detected",
      old_value: "Old subtitle",
      new_value: "New subtitle",
    }],
    keywords: [{
      keyword: { id: "keyword-rising", term: "personality", country: "us", language: "en-US" },
      priority: "medium",
      snapshots: [
        rankSnapshot("2026-07-17", 30),
        rankSnapshot("2026-07-18", 30),
        rankSnapshot("2026-07-19", 30),
        rankSnapshot("2026-07-20", 24),
        rankSnapshot("2026-07-21", 23),
        rankSnapshot("2026-07-22", 22),
        rankSnapshot("2026-07-23", 21),
      ],
    }],
  });

  const [finding] = evaluateRulesForApp(context)
    .filter((item) => item.rule_id === "keyword_rising_after_change");
  assert.ok(finding);
  assert.equal(finding.evidence.find((item) => item.label === "Metadata snapshot").value, "metadata-us-change");
  assert.equal(finding.evidence.find((item) => item.label === "Metadata change time").value, changeTime);
  assert.match(finding.comparison_window, /metadata version observed 2026-07-20T10:00:00.000Z/);
});

test("current exact-locale metadata rows are refreshed in place with versioned evidence", () => {
  const currentDraft = {
    ...draft({
      rule_id: "keyword_opportunity",
      keyword_id: "keyword-personality",
      country: "us",
      locale: "en-US",
      title: "Current metadata opportunity",
      evidence: [
        { label: "Metadata snapshot", value: "metadata-us-v2", source: "public_store" },
        { label: "Metadata version", value: "2.1 · checksum checksum-v2", source: "public_store" },
      ],
      comparison_window: "Rank evidence since metadata version observed 2026-07-25T10:00:00.000Z",
      dedupe_key: "keyword_opportunity:keyword-personality:metadata-us-v2",
    }),
  };
  const legacy = row("legacy-opportunity", "2026-07-20T10:00:00.000Z", {
    rule_id: "keyword_opportunity",
    keyword_id: "keyword-personality",
    country: "us",
    locale: "en-US",
    evidence: [{ label: "Current rank", value: "#18", source: "public_store" }],
    comparison_window: "Last 14 days",
    dedupe_key: "keyword_opportunity:keyword-personality",
  });

  const plan = reconcileMetadataVersionedInsights(
    [currentDraft],
    [legacy],
    NOW,
    [metadataEvidenceScopeKey(APP_ID, "us", "en-US")],
  );
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, "legacy-opportunity");
  assert.equal(plan.updates[0].patch.dedupe_key, currentDraft.dedupe_key);
  assert.equal(plan.updates[0].patch.evidence[0].value, "metadata-us-v2");
});

test("metadata-dependent findings stay silent when either locale is unknown", () => {
  const knownKeyword = { id: "keyword-known", term: "enneagram", country: "us", language: "en-US" };
  const unknownKeyword = { id: "keyword-unknown", term: "personality quiz", country: "us", language: null };

  const unknownSnapshotContext = ruleContext({
    metadataSnapshots: [metadataSnapshot({ locale: null })],
    keywords: [{ keyword: knownKeyword, priority: "high", snapshots: [] }],
  });
  const unknownKeywordContext = ruleContext({
    metadataSnapshots: [metadataSnapshot()],
    keywords: [{ keyword: unknownKeyword, priority: "high", snapshots: [] }],
  });

  for (const context of [unknownSnapshotContext, unknownKeywordContext]) {
    assert.deepEqual(
      evaluateRulesForApp(context).filter((item) =>
        ["metadata_mismatch", "keyword_opportunity", "keyword_rising_after_change", "keyword_declined_after_removal"].includes(item.rule_id),
      ),
      [],
    );
  }
});

test("US and GB metadata findings require independent country-and-locale evidence", () => {
  const context = ruleContext({
    metadataSnapshots: [
      metadataSnapshot({ id: "metadata-us", name: "InnerType", locale: "en-US" }),
      metadataSnapshot({ id: "metadata-gb", country: "gb", name: "InnerType UK", locale: "en-GB" }),
    ],
    keywords: [
      { keyword: { id: "keyword-us", term: "enneagram", country: "us", language: "en-US" }, priority: "high", snapshots: [] },
      { keyword: { id: "keyword-gb", term: "personality quiz", country: "gb", language: "en-GB" }, priority: "high", snapshots: [] },
      { keyword: { id: "keyword-wrong-locale", term: "relationship test", country: "us", language: "en-GB" }, priority: "high", snapshots: [] },
    ],
  });

  const findings = evaluateRulesForApp(context).filter((item) => item.rule_id === "metadata_mismatch");
  assert.deepEqual(
    findings.map((item) => [item.country, item.locale, item.evidence.find((evidence) => evidence.label === "Missing terms").value]),
    [
      ["us", "en-US", "\"enneagram\""],
      ["gb", "en-GB", "\"personality quiz\""],
    ],
  );
});

test("unsupported market metadata findings are superseded without contaminating another market", () => {
  const gbLegacy = row("legacy-gb-opportunity", "2026-07-20T10:00:00.000Z", {
    rule_id: "keyword_opportunity",
    keyword_id: "keyword-personality-gb",
    country: "gb",
    dedupe_key: "keyword_opportunity:keyword-personality-gb",
  });

  const gbPlan = reconcileMetadataVersionedInsights(
    [],
    [gbLegacy],
    NOW,
    [metadataEvidenceScopeKey(APP_ID, "gb", null)],
  );
  assert.equal(gbPlan.updates.length, 1);
  assert.equal(gbPlan.updates[0].patch.status, "superseded");

  const usPlan = reconcileMetadataVersionedInsights(
    [],
    [gbLegacy],
    NOW,
    [metadataEvidenceScopeKey(APP_ID, "us", null)],
  );
  assert.deepEqual(usPlan, { drafts: [], updates: [] });
});

function competitorDraft(overrides = {}) {
  return {
    rule_id: "competitor_wins_high_priority_terms",
    app_id: APP_ID,
    competitor_id: ENNEAGRAM_ID,
    keyword_id: "keyword-current",
    experiment_id: null,
    country: null,
    title: "Enneagram is ahead on 8 high-priority terms",
    observation: "Current competitor gap evidence.",
    interpretation: "Current deterministic competitor diagnosis.",
    recommendation: "Review the focused term cluster.",
    evidence: [{ label: "personality test", value: "InnerType: —; Enneagram: #8", source: "public_store" }],
    comparison_window: "Latest public storefront ranking snapshot",
    confidence: "medium_high",
    impact: "high",
    effort: "medium",
    priority: "high",
    dedupe_key: competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, null),
    ...overrides,
  };
}

function competitorRow(id, createdAt, overrides = {}) {
  return {
    id,
    status: "active",
    created_at: createdAt,
    updated_at: createdAt,
    snoozed_until: null,
    note: null,
    ...competitorDraft(),
    ...overrides,
  };
}

test("competitor identity is stable across changing losing-keyword evidence", () => {
  assert.equal(
    competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, null),
    `competitor_wins_high_priority_terms:${APP_ID}:${ENNEAGRAM_ID}:portfolio`,
  );
  assert.equal(
    competitorDraft({ keyword_id: "keyword-five", title: "Enneagram is ahead on 5 terms" }).dedupe_key,
    competitorDraft({ keyword_id: "keyword-nine", title: "Enneagram is ahead on 9 terms" }).dedupe_key,
  );
});

test("competitor reconciliation preserves three older versions as superseded history", () => {
  const currentDraft = competitorDraft();
  const legacyKey = (suffix) => `competitor_wins_high_priority_terms:${APP_ID}:${ENNEAGRAM_ID}:${suffix}`;
  const rows = [
    competitorRow("five", "2026-07-21T08:00:00.000Z", { competitor_id: null, dedupe_key: legacyKey("five-keywords") }),
    competitorRow("eight-old", "2026-07-21T18:00:00.000Z", { competitor_id: null, dedupe_key: legacyKey("eight-keywords") }),
    competitorRow("nine", "2026-07-21T22:00:00.000Z", { competitor_id: null, dedupe_key: legacyKey("nine-keywords") }),
    competitorRow("eight-current", "2026-07-22T17:00:00.000Z", { competitor_id: null, dedupe_key: legacyKey("current-keywords") }),
  ];

  const plan = reconcileCompetitorWinsInsights([currentDraft], rows, NOW);
  assert.equal(plan.drafts.length, 0);
  assert.equal(plan.updates.length, 4);

  const reconciled = applyPlan(rows, plan);
  assert.equal(reconciled.filter((item) => item.status === "active").length, 1);
  assert.equal(reconciled.find((item) => item.id === "eight-current").competitor_id, ENNEAGRAM_ID);
  assert.equal(reconciled.find((item) => item.id === "eight-current").dedupe_key, competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, null));
  assert.deepEqual(
    reconciled.filter((item) => item.status === "superseded").map((item) => item.id).sort(),
    ["eight-old", "five", "nine"],
  );
});

test("competitor reconciliation keeps distinct competitors and markets separate", () => {
  const otherCompetitor = competitorRow("other-competitor", "2026-07-22T17:00:00.000Z", {
    competitor_id: "competitor-16-personalities",
    dedupe_key: competitorWinsDedupeKey(APP_ID, "competitor-16-personalities", null),
  });
  const otherMarket = competitorRow("other-market", "2026-07-22T17:00:00.000Z", {
    country: "us",
    dedupe_key: competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, "us"),
  });

  const plan = reconcileCompetitorWinsInsights([competitorDraft()], [otherCompetitor, otherMarket], NOW);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.drafts, [competitorDraft()]);
});

test("unchanged competitor reruns are idempotent", () => {
  const currentDraft = competitorDraft();
  const rows = [competitorRow("current", "2026-07-22T17:00:00.000Z")];

  const evaluated = [competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, null)];
  const first = reconcileCompetitorWinsInsights([currentDraft], rows, NOW, evaluated);
  assert.deepEqual(first, { drafts: [], updates: [] });
  const second = reconcileCompetitorWinsInsights([currentDraft], applyPlan(rows, first), NOW, evaluated);
  assert.deepEqual(second, { drafts: [], updates: [] });
});

test("competitor recovery supersedes the evaluated rival row while preserving its evidence", () => {
  const existing = [competitorRow("current", "2026-07-22T17:00:00.000Z")];
  const evaluated = [competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, null)];
  const plan = reconcileCompetitorWinsInsights([], existing, NOW, evaluated);

  assert.deepEqual(plan.drafts, []);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, "current");
  assert.equal(plan.updates[0].patch.status, "superseded");
  assert.match(plan.updates[0].patch.note, /Resolved automatically/);

  const historical = applyPlan(existing, plan)[0];
  assert.deepEqual(historical.evidence, existing[0].evidence);
  assert.equal(historical.title, existing[0].title);
});

test("competitor recovery isolates rivals, apps, and country scopes", () => {
  const otherCompetitorId = "competitor-16-personalities";
  const currentRival = competitorRow("current-rival", "2026-07-22T17:00:00.000Z");
  const stillEmitted = competitorRow("still-emitted", "2026-07-22T17:00:00.000Z", {
    competitor_id: otherCompetitorId,
    dedupe_key: competitorWinsDedupeKey(APP_ID, otherCompetitorId, null),
  });
  const unevaluatedApp = competitorRow("unevaluated-app", "2026-07-22T17:00:00.000Z", {
    app_id: "app-not-evaluated",
    dedupe_key: competitorWinsDedupeKey("app-not-evaluated", ENNEAGRAM_ID, null),
  });
  const unevaluatedRivalId = "competitor-without-recent-evidence";
  const unevaluatedRival = competitorRow("unevaluated-rival", "2026-07-22T17:00:00.000Z", {
    competitor_id: unevaluatedRivalId,
    dedupe_key: competitorWinsDedupeKey(APP_ID, unevaluatedRivalId, null),
  });
  const marketScoped = competitorRow("market-scoped", "2026-07-22T17:00:00.000Z", {
    country: "gb",
    dedupe_key: competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, "gb"),
  });
  const emittedDraft = competitorDraft({
    competitor_id: otherCompetitorId,
    dedupe_key: competitorWinsDedupeKey(APP_ID, otherCompetitorId, null),
  });
  const evaluated = [
    competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, null),
    competitorWinsDedupeKey(APP_ID, otherCompetitorId, null),
  ];

  const plan = reconcileCompetitorWinsInsights(
    [emittedDraft],
    [currentRival, stillEmitted, unevaluatedApp, unevaluatedRival, marketScoped],
    NOW,
    evaluated,
  );

  assert.deepEqual(plan.drafts, []);
  assert.deepEqual(plan.updates.map((update) => update.id), ["current-rival"]);
  assert.equal(plan.updates[0].patch.status, "superseded");
});

test("recovered competitor history remains idempotent", () => {
  const active = [competitorRow("current", "2026-07-22T17:00:00.000Z")];
  const evaluated = [competitorWinsDedupeKey(APP_ID, ENNEAGRAM_ID, null)];
  const recovered = applyPlan(active, reconcileCompetitorWinsInsights([], active, NOW, evaluated));

  assert.deepEqual(reconcileCompetitorWinsInsights([], recovered, NOW, evaluated), { drafts: [], updates: [] });
});

function collectionFailureDraft(overrides = {}) {
  return {
    rule_id: "data_collection_failure",
    app_id: APP_ID,
    keyword_id: null,
    experiment_id: null,
    country: null,
    title: "Data collection needs attention",
    observation: "10 tracked keywords are stale.",
    interpretation: "Stale collection makes conclusions unreliable.",
    recommendation: "Run collection before acting.",
    evidence: [
      { label: "Last successful run", value: "2026-07-20", source: "calculated" },
      { label: "Stale keywords", value: "10", source: "calculated" },
    ],
    comparison_window: "Last 3 days",
    confidence: "high",
    impact: "medium",
    effort: "low",
    priority: "high",
    dedupe_key: `data_collection_failure:${APP_ID}`,
    ...overrides,
  };
}

function collectionFailureRow(id = "failure", overrides = {}) {
  return {
    id,
    status: "active",
    created_at: "2026-07-20T10:00:00.000Z",
    updated_at: "2026-07-20T10:00:00.000Z",
    snoozed_until: null,
    note: null,
    ...collectionFailureDraft(),
    ...overrides,
  };
}

test("recovery supersedes an obsolete collection failure while preserving its evidence", () => {
  const existing = [collectionFailureRow()];
  const plan = reconcileDataCollectionFailureInsights([], existing, NOW);

  assert.deepEqual(plan.drafts, []);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, "failure");
  assert.equal(plan.updates[0].patch.status, "superseded");
  assert.match(plan.updates[0].patch.note, /Resolved automatically/);

  const historical = applyPlan(existing, plan)[0];
  assert.deepEqual(historical.evidence, existing[0].evidence);
});

test("a genuine current collection failure remains active and refreshes changed evidence", () => {
  const existing = [collectionFailureRow()];
  const current = collectionFailureDraft({
    observation: "2 tracked keywords are stale.",
    evidence: [
      { label: "Last successful run", value: "2026-07-30", source: "calculated" },
      { label: "Stale keywords", value: "2", source: "calculated" },
    ],
  });
  const plan = reconcileDataCollectionFailureInsights([current], existing, NOW);

  assert.deepEqual(plan.drafts, []);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].patch.status, undefined);
  assert.equal(plan.updates[0].patch.observation, current.observation);
});

test("a new current collection failure is inserted instead of treated as recovery", () => {
  const current = collectionFailureDraft();
  const plan = reconcileDataCollectionFailureInsights([current], [], NOW);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.drafts, [current]);
});

test("unchanged current collection failures and recovered history are idempotent", () => {
  const current = collectionFailureDraft();
  const active = [collectionFailureRow()];
  assert.deepEqual(reconcileDataCollectionFailureInsights([current], active, NOW), { drafts: [], updates: [] });

  const recovered = applyPlan(active, reconcileDataCollectionFailureInsights([], active, NOW));
  assert.deepEqual(reconcileDataCollectionFailureInsights([], recovered, NOW), { drafts: [], updates: [] });
});
