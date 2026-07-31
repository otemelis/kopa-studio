import assert from "node:assert/strict";
import test from "node:test";

import { mapLookupResult, normalizeExactLocale } from "./providers.js";

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
