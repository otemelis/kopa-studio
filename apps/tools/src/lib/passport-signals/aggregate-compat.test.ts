import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const collector = readFileSync(new URL("../../../../../supabase/functions/passport-ingest-aggregates/index.ts", import.meta.url), "utf8");
const fixture = JSON.parse(readFileSync(new URL("../../../../../supabase/functions/passport-detailed-events/fixtures/schema1_request_accepted.json", import.meta.url), "utf8"));
const catalog = new Set([...(collector.match(/const EVENTS = new Set\((\[[\s\S]*?\])\)/)?.[1].match(/"[a-z_]+"/g) ?? []),
  ...(collector.match(/for \(const event of (\[[\s\S]*?\])\) EVENTS\.add/)?.[1].match(/"[a-z_]+"/g) ?? [])].map((value) => value.slice(1, -1)));

describe("PASSPORT aggregate catalog compatibility", () => {
  it("keeps the 1.2 fixture events and its schema 1 path", () => {
    expect(collector).toContain('p.schema === 2 ? "passport_ingest_batch" : "passport_ingest_daily"');
    for (const day of fixture.request.days) for (const key of Object.keys(day.counts)) {
      expect(catalog.has(key.split("|")[0]), key).toBe(true);
    }
  });
  it("allows the new 1.3 aggregate event names", () => {
    for (const event of ["press_handoff_opened", "travel_import_started", "travel_import_detected", "travel_import_completed", "travel_import_cancelled", "travel_import_undone", "data_exported", "first_stamp_hint_shown", "first_stamp_hint_dismissed", "first_stamp_hint_tapped", "begin_ways_opened", "discovery_intro_shown", "discovery_intro_action", "photo_discovery_stamped", "web_import_completed"]) {
      expect(catalog.has(event), event).toBe(true);
    }
  });
  it("accepts every specified 1.3 property name and bounded value token", () => {
    const properties = new Set((collector.match(/const PROPS = new Set\((\[[\s\S]*?\])\)/)?.[1].match(/"[a-z_]+"/g) ?? []).map((value) => value.slice(1, -1)));
    const required = ["results_bucket", "method", "source", "passport_size", "outcome"];
    const values = ["file", "paste", "places_been", "country_list", "passport", "generic_csv", "flight_csv", "flight_provider", "been_backup", "unreadable", "travel_discovery", "photos", "later", "photo_discovery", "web_import", "bulk_import"];
    for (const key of required) expect(properties.has(key), key).toBe(true);
    for (const value of values) expect(value).toMatch(/^[A-Za-z0-9_+.-]{1,24}$/);
  });
});
