import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const base = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/milestones/passport-p0");
const manifest = JSON.parse(readFileSync(resolve(base, "analytics_event_manifest_v1.json"), "utf8"));
const uuid = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" };
const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "PASSPORT consented detailed event v1 — proposed, disabled",
  type: "object", additionalProperties: false, required: manifest.envelope,
  properties: {
    schema_version: { const: 1 }, event_id: uuid, install_id: uuid, session_id: uuid,
    event_name: { type: "string", enum: Object.keys(manifest.events) },
    occurred_at: { type: "string", format: "date-time" },
    app_version: { type: "string", pattern: "^[0-9]+(\\.[0-9]+){0,2}$" },
    build_number: { type: "string", pattern: "^[0-9]{1,8}$" },
    build_channel: { enum: manifest.build_channels }, device_layout: { enum: manifest.device_layouts },
    screen_id: { enum: manifest.screen_ids }, control_id: { enum: manifest.control_ids },
    properties: { type: "object" },
  },
  allOf: [{ oneOf: Object.entries(manifest.events).map(([event, allowed]) => ({
    properties: { event_name: { const: event }, properties: { type: "object", additionalProperties: false,
      properties: Object.fromEntries(allowed.map((name) => [name, { enum: manifest.property_types[name] }])),
    } },
  })) }],
};
writeFileSync(resolve(base, "analytics_event_schema_v1.json"), `${JSON.stringify(schema, null, 2)}\n`);
