import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { KEYWORDS_PER_RANKING_RUN } from "../../api/aso/collect.js";

test("daily rankings cron capacity covers the current active keyword portfolio", async () => {
  const vercel = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
  const rankingJobs = vercel.crons.filter((cron) => cron.path.startsWith("/api/aso/collect-rankings?slot="));
  const currentActiveKeywordEntries = 231;

  assert.equal(rankingJobs.length, 5, "the portfolio uses five daily ranking slots");
  assert.equal(new Set(rankingJobs.map((cron) => cron.path)).size, 5, "each scheduled slot has a distinct path");
  assert.equal(KEYWORDS_PER_RANKING_RUN, 48);
  assert.equal(rankingJobs.length * KEYWORDS_PER_RANKING_RUN, 240);
  assert.ok(rankingJobs.length * KEYWORDS_PER_RANKING_RUN >= currentActiveKeywordEntries);
});
