import "server-only";
import { Pool } from "pg";
import { z } from "zod";
import { buildPoisReport, type PoisEvent } from "./report";

const configSchema = z.object({
  project: z.literal("dsjgbxkerucutrjltgws"),
  user: z.literal("kopa_report_reader.dsjgbxkerucutrjltgws"),
  host: z.literal("aws-1-us-east-1.pooler.supabase.com"),
  port: z.number().int(),
  database: z.literal("postgres"),
  password: z.string().min(1),
});
let pool: Pool | undefined;

function readerPool() {
  if (pool) return pool;
  const value = process.env.KOPA_POIS_READER_CONFIG;
  const ca = process.env.KOPA_POIS_READER_CA;
  if (!value || !ca) throw new Error("POIS read-only source unavailable");
  const config = configSchema.parse(JSON.parse(value));
  pool = new Pool({
    host: config.host, port: config.port, database: config.database,
    user: config.user, password: config.password,
    ssl: { ca, rejectUnauthorized: true },
    max: 2, connectionTimeoutMillis: 4000, idleTimeoutMillis: 10000,
    statement_timeout: 5000,
    application_name: "kopa_pois_owner_report",
    options: "-c default_transaction_read_only=on",
  });
  return pool;
}

export async function readPoisReport(days: 7 | 28, channel: "appstore" | "testflight") {
  const until = new Date().toISOString();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const client = await readerPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows: identity } = await client.query(
      "SELECT current_user AS role, current_setting('transaction_read_only') AS read_only, has_table_privilege(current_user, 'form.events', 'INSERT,UPDATE,DELETE') AS can_write",
    );
    if (identity[0]?.role !== "kopa_report_reader" || identity[0]?.read_only !== "on" || identity[0]?.can_write)
      throw new Error("POIS source role is not read-only");
    const { rows } = await client.query(
      `SELECT event_id::text AS "eventId", installation_id::text AS "installationId",
              session_id::text AS "sessionId", event_name AS name,
              occurred_at AS "occurredAt", received_at AS "receivedAt",
              app_version AS "appVersion", build_channel AS "buildChannel"
         FROM form.events
        WHERE build_channel = $1 AND occurred_at >= $2 AND occurred_at <= $3
        ORDER BY occurred_at, event_id LIMIT 10001`,
      [channel, since, until],
    );
    if (rows.length > 10000) throw new Error("POIS report row limit reached");
    await client.query("COMMIT");
    const events: PoisEvent[] = rows.map((row) => ({
      ...row,
      occurredAt: row.occurredAt.toISOString(),
      receivedAt: row.receivedAt.toISOString(),
      properties: {},
    }));
    return buildPoisReport(events, channel, since, until);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
