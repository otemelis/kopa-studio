import "server-only";
import { readFile, stat, realpath } from "node:fs/promises";
import { Pool } from "pg";
import { z } from "zod";
import {
  localSnapshotEnabled,
  parseProductScope,
  type ProductEvent,
  type SourceManifest,
} from "./contracts";
import { buildProductReport } from "./engine";
const configSchema = z.object({
  host: z.string().regex(/^\/private\/tmp\/kopa-inner-signal-[a-z0-9]+$/),
  port: z.literal(54329),
  database: z.literal("kopa_innertype"),
  user: z.literal("signal_reader"),
});
const eventSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  app: z.literal("innertype"),
  environment: z.string(),
  name: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  anonymousId: z.string().uuid(),
  sessionId: z.string().uuid(),
  time: z.string().datetime({ offset: true }),
  received: z.string().datetime({ offset: true }),
  country: z.string(),
  version: z.string(),
  platform: z.string(),
  osVersion: z.string(),
  properties: z.record(z.unknown()),
});
const manifestSchema = z.object({
  project: z.literal("dsjgbxkerucutrjltgws"),
  app: z.literal("innertype"),
  cutoff: z.string().datetime(),
  verifiedStableRead: z.literal(true),
  tables: z.object({
    events: z.object({
      rows: z.number().int().positive(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  }),
});
let poolPromise: Promise<Pool> | undefined;
async function pool() {
  if (!localSnapshotEnabled(process.env))
    throw new Error("Read-only local data mode is disabled.");
  if (!poolPromise)
    poolPromise = (async () => {
      const path = process.env.KOPA_PRODUCT_DATABASE_CONFIG;
      if (!path) throw new Error("Local source configuration is missing.");
      const info = await stat(path);
      if ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())
        throw new Error(
          "Private source configuration permissions are invalid.",
        );
      const config = configSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      );
      const host = await realpath(config.host),
        directory = await stat(host);
      if (
        host !== config.host ||
        (directory.mode & 0o077) !== 0 ||
        directory.uid !== process.getuid?.()
      )
        throw new Error("The local database socket is not private.");
      return new Pool({
        ...config,
        max: 3,
        connectionTimeoutMillis: 2500,
        idleTimeoutMillis: 10000,
        statement_timeout: 5000,
        application_name: "signal_readonly_snapshot",
        options: "-c default_transaction_read_only=on",
      });
    })().catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  return poolPromise;
}
/** Only fixed SELECTs against the isolated restored schema. No production credentials or writes. */
export async function readProductReport(params: URLSearchParams) {
  const client = await (await pool()).connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const { rows: roles } = await client.query(
      "SELECT current_user AS name, current_setting('transaction_read_only') AS readonly, has_table_privilege(current_user, 'signal_source.events', 'INSERT,UPDATE,DELETE') AS writable",
    );
    if (
      roles[0].name !== "signal_reader" ||
      roles[0].readonly !== "on" ||
      roles[0].writable
    )
      throw new Error("The source role is not read-only.");
    const { rows: manifests } = await client.query(
      "SELECT manifest FROM signal_source.snapshot_manifest WHERE singleton = true",
    );
    const manifest: SourceManifest = manifestSchema.parse(
      manifests[0]?.manifest,
    );
    const scope = parseProductScope(params, manifest.cutoff);
    if (scope.app !== "innertype")
      throw new Error(
        "Only InnerType has a validated source in this milestone.",
      );
    const { rows } = await client.query(
      `SELECT id::text, app_id AS app, environment, event_name AS name, anonymous_id::text AS "anonymousId", session_id::text AS "sessionId", client_event_time AS time, received_at AS received, COALESCE(country, 'unknown') AS country, COALESCE(app_version, 'unknown') AS version, COALESCE(os_version, 'unknown') AS "osVersion", COALESCE(platform, 'unknown') AS platform, properties FROM signal_source.events WHERE app_id = $1 AND received_at <= $2 ORDER BY id LIMIT 100001`,
      ["innertype", manifest.cutoff],
    );
    if (rows.length !== manifest.tables.events.rows || rows.length > 100000)
      throw new Error(
        "Source row count does not reconcile with the backup manifest.",
      );
    const events: ProductEvent[] = rows.map((row) =>
      eventSchema.parse({
        ...row,
        time: row.time.toISOString(),
        received: row.received.toISOString(),
      }),
    );
    const { rows: catalog } = await client.query(
      "SELECT event_name AS name, required_properties AS required FROM signal_source.event_catalog WHERE app_id = $1 ORDER BY event_name",
      ["innertype"],
    );
    await client.query("COMMIT");
    return buildProductReport(events, catalog, manifest, scope);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
