import test from "node:test";
import assert from "node:assert/strict";
import { classifyAppleWebCards } from "../../api/aso/_lib/search-results.js";

test("Apple web observations exclude only explicitly labeled ads from organic positions", () => {
  const result = classifyAppleWebCards([
    { id: "1234567", name: "Sponsored result", explicitAd: true },
    { id: "2345678", name: "Organic app", explicitAd: false },
    { id: "3456789", name: "Second organic app", explicitAd: false },
    { id: "2345678", name: "Duplicate render", explicitAd: false },
  ]);
  assert.equal(result.depth, 2);
  assert.equal(result.explicitAdCount, 1);
  assert.deepEqual(result.positions, { "2345678": 1, "3456789": 2 });
  assert.equal(result.ordered[0].position, null);
});

test("Apple web observations preserve incomplete depth and never invent a position", () => {
  const result = classifyAppleWebCards([{ id: "4567890", name: "Only visible card", explicitAd: false }]);
  assert.equal(result.depth, 1);
  assert.equal(result.positions["9999999"], undefined);
});
