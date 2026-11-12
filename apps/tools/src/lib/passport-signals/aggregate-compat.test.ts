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
    for (const event of ["press_handoff_opened", "travel_import_started", "travel_import_completed", "first_stamp_hint_tapped", "discovery_intro_action", "photo_discovery_stamped", "web_import_completed"]) {
      expect(catalog.has(event), event).toBe(true);
    }
  });
});
