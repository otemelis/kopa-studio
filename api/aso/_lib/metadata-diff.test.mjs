import assert from "node:assert/strict";
import test from "node:test";

import { metadataChecksum } from "./metadata-diff.js";

const fields = {
  name: "InnerType",
  subtitle: "Personality test",
  description: "Know yourself.",
  icon_url: "https://example.com/icon.png",
  screenshot_urls: [],
  current_version: "2.1",
  release_notes: "Updates.",
  price: 0,
};

test("unknown locale preserves the legacy metadata checksum identity", () => {
  assert.equal(metadataChecksum(fields), metadataChecksum({ ...fields, locale: null }));
});

test("an explicit locale becomes part of metadata snapshot identity", () => {
  assert.notEqual(metadataChecksum(fields), metadataChecksum({ ...fields, locale: "en-US" }));
  assert.notEqual(
    metadataChecksum({ ...fields, locale: "en-US" }),
    metadataChecksum({ ...fields, locale: "en-GB" }),
  );
});
