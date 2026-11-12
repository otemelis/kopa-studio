// PASSPORT anonymous daily usage counts → passport_analytics.daily_counts (innertype project, PASSPORT-only tables).
// Strictly validated against the app's event catalog (generated from Passport/App/Analytics.swift).
// No sender IP/headers/person/device identifiers are stored. Schema 2 adds an expiring per-batch retry token.
import { createClient } from "jsr:@supabase/supabase-js@2";

const EVENTS = new Set(["app_opened", "app_backgrounded", "cover_opened", "cover_closed", "device_unfolded", "device_folded", "onboarding_presented", "onboarding_name_completed", "onboarding_name_skipped", "language_selected", "name_updated", "first_stamp_hint_shown", "first_stamp_hint_dismissed", "journey_hint_shown", "onboarding_completed", "first_stamp_completed", "stamp_editor_opened", "stamp_collection_selected", "stamp_search_used", "stamp_destination_selected", "stamp_date_precision_selected", "stamp_date_field_opened", "stamp_departure_toggled", "stamp_mode_selected", "stamp_confirm_tapped", "stamp_editor_cancelled", "stamp_animation_started", "stamp_animation_completed", "stamp_animation_skipped", "stamp_created", "stamps_bulk_created", "stamp_create_failed", "stamp_milestone_reached", "page_turned", "page_turn_cancelled", "rapid_turn_burst", "paper_tapped", "add_stamp_hint_shown", "add_stamp_hint_selected", "bookmark_selected", "journey_opened", "index_opened", "collection_filter_changed", "view_lens_changed", "journey_region_changed", "trip_opened", "trip_closed", "trip_menu_opened", "trip_edit_opened", "trip_edit_saved", "trip_edit_cancelled", "trip_delete_requested", "trip_delete_confirmed", "trip_delete_cancelled", "overlay_dismissed", "backup_export_tapped", "backup_export_finished", "backup_restore_tapped", "backup_restore_finished", "note_editor_opened", "note_saved", "photo_picker_opened", "photo_suggestions_requested", "photo_suggestions_result", "photo_suggestions_reviewed", "photos_attached", "photo_replaced", "photo_removed", "photo_menu_opened", "photo_frame_changed", "photo_arrangement_changed", "passport_library_opened", "collection_viewed", "parks_passport_previewed", "parks_purchase_started", "parks_purchase_completed", "parks_purchase_ended", "parks_passport_opened", "park_selected", "park_stamp_added", "park_visit_edited", "park_visit_deleted", "linked_stamp_created", "linked_stamp_skipped", "parks_journey_viewed", "flight_log_previewed", "flight_log_purchase_started", "flight_log_purchase_completed", "flight_log_purchase_ended", "flight_log_opened", "parks_first_record", "volume_entitlement_activated", "volume_entitlement_revoked", "aviation_ledger_viewed", "aviation_ledger_share_opened", "airport_search_used", "flight_logged", "airport_collected", "flight_log_first_record", "route_atlas_viewed", "flight_import_started", "flight_import_completed", "flight_import_undone", "flight_log_exported", "flight_link_decision", "parks_journey_shared", "riffle_used", "photo_limit_reached", "share_opened", "share_format_selected", "share_option_toggled", "share_image_generated", "share_image_failed", "share_sheet_opened", "review_prompt_eligible", "review_prompt_suppressed", "review_prompt_requested", "rate_tapped", "feedback_tapped", "atelier_opened", "atelier_closed", "edition_viewed", "edition_previewed", "edition_equipped", "purchase_started", "purchase_completed", "purchase_cancelled", "purchase_pending", "purchase_failed", "restore_tapped", "restore_completed", "atelier_products_unavailable", "explorer_unlocked", "edition_reveal_shown", "app_icon_changed", "save_failed", "navigation_fallback"]);
const PROPS = new Set(["action", "available", "changed", "changed_city", "changed_dates", "changed_destination", "changed_precision", "collection", "count", "days_since_install", "days_since_last_open", "destination_kind", "direction", "edition", "enabled", "field", "filter", "first_use", "format", "had_selection", "has_city", "has_departure", "has_note", "has_photos", "language", "language_changed", "layout_at_start", "lens", "marks", "method", "milestone", "mode", "name_kind", "offered", "option", "outcome", "overlay", "page_kind", "passport_size", "precision", "previous_language", "purpose", "reason", "region", "repeat_visit", "results_bucket", "seconds", "source", "style", "cover", "ownership", "currency", "price_cents", "has_name", "has_initials", "match_kind", "volume", "access_mode", "layout"]);
// Additive PASSPORT 1.3 catalog. Existing 1.2 event names and stored counts are unchanged.
for (const event of ["photo_discovery_shown", "photo_discovery_opened", "photo_discovery_scan_requested", "photo_discovery_permission", "photo_discovery_scan_ended", "photo_discovery_stamped", "photo_discovery_share_opened", "photo_discovery_cleared", "web_import_opened", "web_import_rejected", "web_import_cancelled", "web_import_completed", "web_import_undone", "press_handoff_opened", "travel_import_started", "travel_import_detected", "travel_import_completed", "travel_import_cancelled", "travel_import_undone", "data_exported", "first_stamp_hint_tapped", "begin_ways_opened", "discovery_intro_shown", "discovery_intro_action"]) EVENTS.add(event);
const MAX_BODY = 512 * 1024, MAX_DAYS = 40, MAX_KEYS = 2000, MAX_COUNT = 100000;
const VALUE = /^[A-Za-z0-9_+.-]{1,24}$/;
const VERSION = /^[0-9]+(\.[0-9]+){0,2}$/;
const CHANNELS = new Set(["debug", "testflight", "appstore"]);

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: { "Content-Type": "application/json" } });
}

function validKey(key: string): boolean {
  if (key.length > 350) return false;
  const [event, ...dims] = key.split("|");
  if (!EVENTS.has(event)) return false;
  for (const d of dims) {
    const i = d.indexOf("=");
    if (i < 1) return false;
    if (!PROPS.has(d.slice(0, i)) || !VALUE.test(d.slice(i + 1))) return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return bad("POST only", 405);
  const text = await req.text();
  if (text.length > MAX_BODY) return bad("too large", 413);
  let p: any;
  try { p = JSON.parse(text); } catch { return bad("json"); }
  if (![1, 2].includes(p?.schema) || !CHANNELS.has(p.build_channel) || !VERSION.test(p.app_version ?? "") || !Array.isArray(p.days)) return bad("shape");
  if (p.days.length === 0 || p.days.length > MAX_DAYS) return bad("days");
  if (p.schema === 2 && (typeof p.batch_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.batch_id)
      || Object.keys(p).some(k => !["schema", "batch_id", "build_channel", "app_version", "days"].includes(k)))) return bad("batch");
  const seenDays = new Set<string>();
  const rejected: string[] = [];
  const days: { day: string; counts: Record<string, number> }[] = [];
  const today = Date.now(), oldest = today - (MAX_DAYS + 1) * 86400000, newest = today + 2 * 86400000;
  for (const d of p.days) {
    const t = Date.parse(d?.day + "T12:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.day ?? "") || isNaN(t) || t < oldest || t > newest) return bad("day");
    if (p.schema === 2 && (new Date(t).toISOString().slice(0,10) !== d.day || seenDays.has(d.day)
        || Object.keys(d).some(k => !["day", "counts"].includes(k)))) return bad("day");
    seenDays.add(d.day);
    const entries = Object.entries(d.counts ?? {});
    if (entries.length === 0 || entries.length > MAX_KEYS) return bad("counts");
    // One unknown key (an older or newer app's catalog) costs that key, never the batch. Accepted keys keep every check.
    const kept: Record<string, number> = {};
    for (const [k, v] of entries) {
      if (validKey(k) && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_COUNT) kept[k] = v as number;
      else rejected.push(k);
    }
    if (Object.keys(kept).length > 0) days.push({ day: d.day, counts: kept });
  }
  // Bounded and sanitised: event names only, never the values.
  if (rejected.length > 0) console.warn(JSON.stringify({ rejected: rejected.length, sample: rejected.slice(0, 5).map(k => k.split("|")[0].replace(/[^a-z0-9_]/g, "").slice(0, 40)) }));
  if (days.length === 0) return new Response(JSON.stringify({ ok: true, rows: 0, rejected: rejected.length }), { headers: { "Content-Type": "application/json" } });
  const clean = { ...p, days };
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await db.rpc(p.schema === 2 ? "passport_ingest_batch" : "passport_ingest_daily", { payload: clean });
  if (error) return bad("store", 500);
  const acknowledgement = p.schema === 2 ? {
    ok: true, schema: 2, batch_id: p.batch_id, rows: data, rejected: rejected.length,
    payload_hash: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), b => b.toString(16).padStart(2, "0")).join("")
  } : { ok: true, rows: data, rejected: rejected.length };
  return new Response(JSON.stringify(acknowledgement), { headers: { "Content-Type": "application/json" } });
});
