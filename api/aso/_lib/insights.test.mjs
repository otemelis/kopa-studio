import assert from "node:assert/strict";
import test from "node:test";

import {
  metadataMismatchDedupeKey,
  reconcileMetadataMismatchInsights,
} from "./insights.js";

const NOW = new Date("2026-07-30T12:00:00.000Z");
const APP_ID = "app-inner-type";

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
