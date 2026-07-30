import assert from "node:assert/strict";
import test from "node:test";

import {
  competitorWinsDedupeKey,
  metadataMismatchDedupeKey,
  reconcileCompetitorWinsInsights,
  reconcileDataCollectionFailureInsights,
  reconcileMetadataMismatchInsights,
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
  assert.equal(metadataMismatchDedupeKey(APP_ID, null), `metadata_mismatch:${APP_ID}:portfolio`);
  assert.equal(metadataMismatchDedupeKey(APP_ID, "GB"), `metadata_mismatch:${APP_ID}:gb`);
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

  const plan = reconcileMetadataMismatchInsights([gbDraft], rows, NOW);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.drafts, [gbDraft]);
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

  const first = reconcileCompetitorWinsInsights([currentDraft], rows, NOW);
  assert.deepEqual(first, { drafts: [], updates: [] });
  const second = reconcileCompetitorWinsInsights([currentDraft], applyPlan(rows, first), NOW);
  assert.deepEqual(second, { drafts: [], updates: [] });
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
