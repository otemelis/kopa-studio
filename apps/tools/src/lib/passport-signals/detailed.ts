import "server-only";
import { readerPool } from "@/lib/pois-live/source";

export type DetailedGroup = { event: string; day: string; installs: number; events: number; latest: string };
export type FunnelStep = { label: string; installs: number | null };
export type DetailedReport = { available: true; groups: DetailedGroup[]; funnel: FunnelStep[]; optedInInstalls: number | null; latestBuild: string | null; latest: string | null; version: string; channel: string }
  | { available: false; reason: string };

// The reader has SELECT only. No individual event or installation identifier is
// returned to the page; the HAVING clause is the privacy threshold.
export async function readPassportDetailed(days: 7 | 28, channel: "appstore" | "testflight" | "debug", version = "all"): Promise<DetailedReport> {
  if (version !== "all" && !/^[0-9]+(\.[0-9]+){0,2}$/.test(version)) return { available: false, reason: "Invalid app-version filter." };
  const client = await readerPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows: role } = await client.query("SELECT current_user AS role, current_setting('transaction_read_only') AS read_only, has_table_privilege(current_user, 'passport_analytics.passport_detailed_events', 'INSERT,UPDATE,DELETE') AS can_write");
    if (role[0]?.role !== "kopa_report_reader" || role[0]?.read_only !== "on" || role[0]?.can_write) throw new Error("Reader role is not read-only");
    const { rows: coverage } = await client.query(
      `SELECT max(received_at) AS latest,
              CASE WHEN count(DISTINCT install_id) >= 5 THEN count(DISTINCT install_id)::int END AS installs
         FROM passport_analytics.passport_detailed_events
        WHERE build_channel = $1 AND ($2 = 'all' OR app_version = $2)
          AND occurred_at >= now() - ($3::int * interval '1 day')`, [channel, version, days]);
    const { rows } = await client.query(
      `SELECT event_name AS event, (occurred_at AT TIME ZONE 'UTC')::date::text AS day,
              count(DISTINCT install_id)::int AS installs, count(*)::int AS events,
              max(received_at) AS latest
         FROM passport_analytics.passport_detailed_events
        WHERE build_channel = $1 AND ($2 = 'all' OR app_version = $2)
          AND occurred_at >= now() - ($3::int * interval '1 day')
        GROUP BY event_name, (occurred_at AT TIME ZONE 'UTC')::date
       HAVING count(DISTINCT install_id) >= 5
        ORDER BY day, event_name LIMIT 3000`, [channel, version, days]);
    const { rows: funnelRows } = await client.query(
      `WITH per_install AS (
         SELECT install_id,
           min(occurred_at) FILTER (WHERE event_name = 'cover_opened') AS cover_at,
           min(occurred_at) FILTER (WHERE event_name = 'onboarding_presented') AS onboarding_at,
           min(occurred_at) FILTER (WHERE event_name = 'stamp_created') AS stamp_at,
           min(occurred_at) FILTER (WHERE event_name = 'journey_opened') AS journey_at
         FROM passport_analytics.passport_detailed_events
         WHERE build_channel = $1 AND ($2 = 'all' OR app_version = $2)
           AND occurred_at >= now() - ($3::int * interval '1 day')
         GROUP BY install_id
       ), counts AS (
         SELECT count(*) FILTER (WHERE cover_at IS NOT NULL) AS cover,
           count(*) FILTER (WHERE onboarding_at >= cover_at) AS onboarding,
           count(*) FILTER (WHERE stamp_at >= onboarding_at AND onboarding_at >= cover_at) AS stamp,
           count(*) FILTER (WHERE journey_at >= stamp_at AND stamp_at >= onboarding_at AND onboarding_at >= cover_at) AS journey
         FROM per_install
       )
       SELECT CASE WHEN cover >= 5 THEN cover::int END AS cover,
              CASE WHEN onboarding >= 5 THEN onboarding::int END AS onboarding,
              CASE WHEN stamp >= 5 THEN stamp::int END AS stamp,
              CASE WHEN journey >= 5 THEN journey::int END AS journey FROM counts`, [channel, version, days]);
    const { rows: builds } = await client.query(
      `SELECT app_version, build_number FROM passport_analytics.passport_detailed_events
        WHERE build_channel = $1 AND ($2 = 'all' OR app_version = $2)
          AND occurred_at >= now() - ($3::int * interval '1 day')
        GROUP BY app_version, build_number HAVING count(DISTINCT install_id) >= 5
        ORDER BY max(received_at) DESC LIMIT 1`, [channel, version, days]);
    await client.query("COMMIT");
    return { available: true, groups: rows.map((row) => ({ ...row, latest: row.latest.toISOString() })),
      funnel: [["Cover opened", "cover"], ["Onboarding presented", "onboarding"], ["First stamp created", "stamp"], ["Journey opened", "journey"]]
        .map(([label, key]) => ({ label, installs: funnelRows[0]?.[key] ?? null })),
      optedInInstalls: coverage[0]?.installs ?? null,
      latestBuild: builds[0] ? `${builds[0].app_version} (${builds[0].build_number})` : null,
      latest: coverage[0]?.latest?.toISOString() ?? null, version, channel };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { available: false, reason: "Detailed PASSPORT source is unavailable. No data was substituted." };
  } finally { client.release(); }
}

export const detailedSections = [
  ["First use", ["install_started", "cover_opened", "onboarding_presented", "onboarding_completed", "stamp_created", "journey_opened"]],
  ["Imports", ["flight_import_picker_opened", "flight_import_file_selected", "flight_import_previewed", "flight_import_completed", "flight_import_cancelled", "flight_import_failed", "flight_import_undone"]],
  ["Travel Discovery", ["discovery_feature_activated", "discovery_permission_result", "discovery_candidate_created", "discovery_candidate_suppressed", "discovery_suggestion_accepted", "discovery_suggestion_dismissed", "discovery_notification_scheduled", "discovery_notification_opened", "discovery_false_positive_reported"]],
  ["Stamps and sharing", ["stamp_editor_opened", "stamp_created", "stamp_milestone_reached", "share_sheet_opened"]],
  ["Monetisation discovery", ["edition_viewed", "purchase_started", "purchase_completed", "restore_completed"]],
] as const;

export function detailedEventTotal(rows: DetailedGroup[], event: string) {
  const matching = rows.filter((row) => row.event === event);
  return matching.length ? matching.reduce((sum, row) => sum + row.events, 0) : null;
}
