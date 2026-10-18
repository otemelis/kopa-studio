import assert from "node:assert/strict";
import test from "node:test";

import { lookupApp, mapLookupResult, normalizeExactLocale } from "./providers.js";

test("exact App Store locale normalization accepts only language-region evidence", () => {
  assert.equal(normalizeExactLocale("en_us"), "en-US");
  assert.equal(normalizeExactLocale("EN-gb"), "en-GB");
  assert.equal(normalizeExactLocale("en"), null);
  assert.equal(normalizeExactLocale(""), null);
});

test("supported languages never become an inferred listing locale", () => {
  const mapped = mapLookupResult({
    trackId: 123,
    trackName: "InnerType",
    languageCodesISO2A: ["EN", "DE"],
  });
  assert.deepEqual(mapped.languages, ["EN", "DE"]);
  assert.equal(mapped.locale, null);
});

test("an explicit structured locale is preserved", () => {
  const mapped = mapLookupResult({
    trackId: 123,
    trackName: "InnerType",
    locale: "en_GB",
    languageCodesISO2A: ["EN"],
  });
  assert.equal(mapped.locale, "en-GB");
});

test("a missing storefront listing is an unavailable observation, not a retried provider failure", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("Not found", { status: 404 });
  };
  try {
    assert.equal(await lookupApp("6822753543", "us"), null);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("transient storefront lookup failures remain failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  try {
    await assert.rejects(lookupApp("6785764991", "us"), /HTTP 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
