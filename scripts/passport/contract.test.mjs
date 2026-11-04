import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const requireTools = createRequire(new URL("../../apps/tools/package.json", import.meta.url));
const Ajv = requireTools("ajv");
const root = new URL("../../docs/milestones/passport-p0/", import.meta.url);
const read = (file) => JSON.parse(readFileSync(new URL(file, root), "utf8"));
const manifest = read("analytics_event_manifest_v1.json");
const schema = read("analytics_event_schema_v1.json");
const validate = new Ajv({ allErrors: true }).compile(schema);
const positive = read("fixtures/positive.json").events;

test("contract manifest and generated schema cover the same event vocabulary", () => {
  assert.deepEqual(schema.properties.event_name.enum, Object.keys(manifest.events));
  assert.equal(manifest.consent, "explicit-opt-in-default-off");
  assert.equal(manifest.schema_version, 1);
});

test("positive semantic events validate without geography", () => {
  for (const event of positive) assert.equal(validate(event), true, JSON.stringify(validate.errors));
});

test("negative privacy and type fixtures are rejected", () => {
  for (const example of read("fixtures/negative.json").cases) {
    const event = { ...positive[example.base], ...example.override };
    assert.equal(validate(event), false, example.reason);
  }
});
