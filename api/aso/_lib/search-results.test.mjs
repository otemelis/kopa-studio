import test from "node:test";
import assert from "node:assert/strict";
import { buildKeywordSearchSnapshot, classifyAppleWebCards } from "./search-results.js";

test("iTunes snapshots keep the first 100 IDs in catalog order, labeled as catalog results", () => {
  const rows = Array.from({ length: 125 }, (_, index) => ({
    position: index + 1,
    store_app_id: String(100000 + index),
    name: `App ${index + 1}`,
    developer: "Publisher",
  }));

  const snapshot = buildKeywordSearchSnapshot("itunes_catalog", rows);

  assert.equal(snapshot.results.length, 100);
  assert.equal(snapshot.resultDepth, 100);
  assert.deepEqual(snapshot.results[0], {
    observed_position: 1,
    store_app_id: "100000",
    name: "App 1",
    developer: "Publisher",
    classification: "catalog_result",
    catalog_position: 1,
    organic_position: null,
    explicit_ad: false,
  });
  assert.equal(snapshot.results.at(-1).store_app_id, "100099");
  assert.equal(snapshot.results.at(-1).catalog_position, 100);
});

test("web snapshots preserve observed order and keep ad slots out of organic positions", () => {
  const snapshot = buildKeywordSearchSnapshot("apple_web_search", [
    { id: "123456", name: "Sponsored", explicitAd: true, position: null },
    { id: "234567", name: "Result A", explicitAd: false, position: 1 },
    { id: "345678", name: "Result B", explicitAd: false, position: 2 },
  ]);

  assert.equal(snapshot.resultDepth, 2);
  assert.deepEqual(snapshot.results.map((row) => [row.observed_position, row.classification, row.organic_position]), [
    [1, "ad", null],
    [2, "unclassified", 1],
    [3, "unclassified", 2],
  ]);
  assert.deepEqual(snapshot.results.map((row) => row.store_app_id), ["123456", "234567", "345678"]);
});

test("missing or malformed app IDs are omitted without inventing positions", () => {
  const snapshot = buildKeywordSearchSnapshot("apple_web_search", [
    { id: null, name: "Unidentifiable card" },
    { id: "456789", name: "Identifiable card", position: 1 },
  ]);

  assert.equal(snapshot.results.length, 1);
  assert.equal(snapshot.results[0].store_app_id, "456789");
  assert.equal(snapshot.results[0].observed_position, 2);
  assert.equal(snapshot.results[0].organic_position, 1);
});

test("unavailable sources cannot be stored under a guessed source label", () => {
  assert.throws(() => buildKeywordSearchSnapshot("appfollow", []), /Unsupported search result source/);
});

test("Apple web classification is capped at the first 100 observed cards", () => {
  const cards = Array.from({ length: 125 }, (_, index) => ({ id: String(100000 + index), name: `App ${index + 1}` }));
  cards[0].explicitAd = true;

  const observation = classifyAppleWebCards(cards);

  assert.equal(observation.ordered.length, 100);
  assert.equal(observation.depth, 99);
  assert.equal(observation.ordered[0].explicitAd, true);
  assert.equal(observation.ordered[1].position, 1);
  assert.equal(observation.ordered.at(-1).id, "100099");
  assert.equal(observation.positions["100099"], 99);
});
