import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { splitBatch, validateEvent } from "../../../../../supabase/functions/passport-detailed-events/contract";

const fixture = JSON.parse(readFileSync(new URL("../../../../../supabase/functions/passport-detailed-events/manifest.json", import.meta.url), "utf8"));
const appFixtures = JSON.parse(readFileSync(new URL("../../../../../supabase/functions/passport-detailed-events/fixtures/positive.json", import.meta.url), "utf8"));
const negativeFixtures = JSON.parse(readFileSync(new URL("../../../../../supabase/functions/passport-detailed-events/fixtures/negative.json", import.meta.url), "utf8"));
const sample = {
  schema_version: 1, event_id: "11111111-1111-4111-8111-111111111111",
  install_id: "22222222-2222-4222-8222-222222222222",
  session_id: "33333333-3333-4333-8333-333333333333",
  event_name: "stamp_created", occurred_at: new Date().toISOString(), app_version: "1.3", build_number: "1",
  build_channel: "testflight", device_layout: "regular", screen_id: "stamp_editor", control_id: "confirm_stamp",
  properties: { collection_type: "country", creation_source: "manual" },
};

describe("PASSPORT detailed v1 contract", () => {
  it("keeps the application manifest and accepts its valid stamp envelope", () => {
    expect(fixture.events.stamp_created).toEqual(["collection_type", "creation_source"]);
    expect(validateEvent(sample)).toBe(true);
    expect(splitBatch({ schema_version: 1, events: [sample] })?.accepted).toHaveLength(1);
  });
  it("accepts the app's positive fixture events", () => {
    expect(appFixtures.events.every((event: unknown) => validateEvent(event, new Date("2026-11-12T12:00:00Z").getTime()))).toBe(true);
  });
  it("rejects every app negative fixture", () => {
    for (const item of negativeFixtures.cases) {
      expect(validateEvent({ ...appFixtures.events[item.base], ...item.override }, new Date("2026-11-12T12:00:00Z").getTime()), item.reason).toBe(false);
    }
  });
  it("rejects forbidden free text, unknown properties and altered identifiers", () => {
    expect(validateEvent({ ...sample, properties: { ...sample.properties, country: "DE" } })).toBe(false);
    expect(validateEvent({ ...sample, install_id: "not-a-uuid" })).toBe(false);
    expect(validateEvent({ ...sample, screen_id: "my_private_trip" })).toBe(false);
    expect(validateEvent({ ...sample, occurred_at: "2020-01-01T00:00:00Z" })).toBe(false);
  });
  it("rejects a second installation and duplicate IDs in a batch", () => {
    const mixed = splitBatch({ schema_version: 1, events: [sample, { ...sample, event_id: "44444444-4444-4444-8444-444444444444", install_id: "55555555-5555-4555-8555-555555555555" }] });
    expect(mixed?.accepted).toHaveLength(1);
    expect(mixed?.rejected[0].code).toBe("mixed_install");
    const duplicate = splitBatch({ schema_version: 1, events: [sample, sample] });
    expect(duplicate?.rejected[0].code).toBe("duplicate_in_batch");
  });
  it("rejects extra batch keys and more than 50 entries", () => {
    expect(splitBatch({ schema_version: 1, events: [sample], extra: true })).toBeNull();
    expect(splitBatch({ schema_version: 1, events: Array(51).fill(sample) })).toBeNull();
  });
});
