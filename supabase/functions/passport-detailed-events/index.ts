import { createClient } from "jsr:@supabase/supabase-js@2";
import { splitBatch, uuid4 } from "./contract.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const tokenPattern = /^[0-9a-f]{64}$/;

async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST" && request.method !== "DELETE") return json({ error: "method_not_allowed" }, 405);
  const token = request.headers.get("X-Passport-Erase-Token") ?? "";
  if (!tokenPattern.test(token)) return json({ error: "invalid_token" }, 403);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "unavailable" }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const hash = await sha256(token);

  if (request.method === "DELETE") {
    const install = request.headers.get("X-Passport-Install-Id") ?? "";
    if (!uuid4.test(install)) return json({ error: "invalid_install" }, 400);
    const { data, error } = await db.rpc("passport_detailed_erase", { p_install: install, p_hash: hash });
    if (error) return json({ error: "store_unavailable" }, 503);
    return data?.forbidden ? json({ error: "invalid_token" }, 403) : json({ schema_version: 1, erased: true });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "content_type" }, 415);
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 131_072) return json({ error: "body_too_large" }, 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > 131_072) return json({ error: "body_too_large" }, 413);
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return json({ error: "invalid_json" }, 400); }
  const batch = splitBatch(parsed);
  if (!batch) return json({ error: "invalid_batch" }, 400);
  if (!batch.accepted.length) return json({ schema_version: 1, accepted: [], duplicates: [], rejected: batch.rejected });
  const { data, error } = await db.rpc("passport_detailed_ingest", {
    p_install: batch.install, p_hash: hash, p_events: batch.accepted,
  });
  if (error) return json({ error: "store_unavailable" }, 503);
  if (data?.forbidden) return json({ error: "invalid_token" }, 403);
  if (data?.rate_limited) return json({ error: "rate_limited" }, 429);
  if (!data || data.schema_version !== 1 || !Array.isArray(data.accepted) || !Array.isArray(data.duplicates) || !Array.isArray(data.rejected))
    return json({ error: "store_unavailable" }, 503);
  return json({ ...data, rejected: [...batch.rejected, ...data.rejected] });
});
