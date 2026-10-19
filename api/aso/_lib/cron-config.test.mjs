import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootConfig = JSON.parse(await readFile(new URL("../../../vercel.json", import.meta.url), "utf8"));
const toolsConfig = JSON.parse(await readFile(new URL("../../../apps/tools/vercel.json", import.meta.url), "utf8"));

test("collector deployment owns five distinct daily ranking slots and maintenance", () => {
  const rankings = rootConfig.crons.filter(({ path }) => path.startsWith("/api/aso/collect-rankings?slot="));
  assert.deepEqual(rankings.map(({ path, schedule }) => [path, schedule]), [
    ["/api/aso/collect-rankings?slot=1", "30 0 * * *"],
    ["/api/aso/collect-rankings?slot=2", "30 4 * * *"],
    ["/api/aso/collect-rankings?slot=3", "30 8 * * *"],
    ["/api/aso/collect-rankings?slot=4", "30 12 * * *"],
    ["/api/aso/collect-rankings?slot=5", "30 16 * * *"],
  ]);
  assert.equal(rootConfig.crons.filter(({ path }) => path === "/api/aso/collect-maintenance").length, 1);
  assert.equal(rootConfig.functions["api/aso/collect-rankings.js"].maxDuration, 300);
  assert.equal(rootConfig.functions["api/aso/collect-maintenance.js"].maxDuration, 300);
});

test("Tools proxy does not duplicate collector cron schedules", () => {
  assert.equal(toolsConfig.crons, undefined);
});
