import manifest from "./manifest.json" with { type: "json" };

export type DetailedEvent = Record<string, unknown> & { event_id: string; install_id: string };
export const uuid4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const version = /^[0-9]+(\.[0-9]+){0,2}$/;
const build = /^[0-9]{1,8}$/;
const keys = new Set(manifest.envelope);
const inList = (value: unknown, list: readonly string[]) => typeof value === "string" && list.includes(value);

export function validateEvent(value: unknown, now = Date.now()): value is DetailedEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (Object.keys(event).length !== keys.size || Object.keys(event).some((key) => !keys.has(key))) return false;
  if (event.schema_version !== 1) return false;
  if (![event.event_id, event.install_id, event.session_id].every((id) => typeof id === "string" && uuid4.test(id))) return false;
  if (typeof event.event_name !== "string" || !(event.event_name in manifest.events)) return false;
  if (typeof event.occurred_at !== "string" || !timestamp.test(event.occurred_at)) return false;
  const occurred = Date.parse(event.occurred_at);
  if (!Number.isFinite(occurred) || occurred < now - 35 * 86_400_000 || occurred > now + 86_400_000) return false;
  if (typeof event.app_version !== "string" || !version.test(event.app_version)) return false;
  if (typeof event.build_number !== "string" || !build.test(event.build_number)) return false;
  if (!inList(event.build_channel, manifest.build_channels) || !inList(event.device_layout, manifest.device_layouts)
    || !inList(event.screen_id, manifest.screen_ids) || !inList(event.control_id, manifest.control_ids)) return false;
  const props = event.properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return false;
  const required = manifest.events[event.event_name as keyof typeof manifest.events] as string[];
  const properties = props as Record<string, unknown>;
  if (Object.keys(properties).length !== required.length || Object.keys(properties).some((key) => !required.includes(key))) return false;
  return required.every((key) => inList(properties[key], manifest.property_types[key as keyof typeof manifest.property_types]));
}

export function splitBatch(payload: unknown, now = Date.now()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const body = payload as Record<string, unknown>;
  if (Object.keys(body).length !== 2 || !Object.hasOwn(body, "schema_version") || !Object.hasOwn(body, "events")
    || body.schema_version !== 1 || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 50) return null;
  const accepted: DetailedEvent[] = [];
  const rejected: { event_id: string; code: string }[] = [];
  const ids = new Set<string>();
  let install: string | null = null;
  for (const item of body.events) {
    if (!validateEvent(item, now)) {
      rejected.push({ event_id: typeof item?.event_id === "string" ? item.event_id : "", code: "invalid_event" });
      continue;
    }
    if (!install) install = item.install_id;
    if (item.install_id !== install) { rejected.push({ event_id: item.event_id, code: "mixed_install" }); continue; }
    if (ids.has(item.event_id)) { rejected.push({ event_id: item.event_id, code: "duplicate_in_batch" }); continue; }
    ids.add(item.event_id);
    accepted.push(item);
  }
  return { install, accepted, rejected };
}
