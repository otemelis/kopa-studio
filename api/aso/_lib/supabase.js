// Tiny PostgREST + Auth helper for the ASO serverless functions. No SDK
// dependency (this project has no package installs beyond the Vercel
// runtime) — plain fetch calls against Supabase's REST and Auth APIs.

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

/** First defined env var among several accepted names — mirrors the same
 * fallback chain api/config.js already uses, since this project's Vercel
 * env vars are named NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (carried over from before), not the plain SUPABASE_URL / SUPABASE_ANON_KEY
 * names used elsewhere in this file's original version. */
function envAny(names) {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  throw new Error(`Missing environment variable (any of): ${names.join(", ")}`);
}

export function supabaseUrl() {
  return envAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"]);
}

/** Service-role REST client — bypasses RLS. Server-side only, never expose. */
export function serviceClient() {
  const url = supabaseUrl();
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  async function request(path, init) {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Supabase ${res.status} on ${path}: ${text.slice(0, 300)}`);
    }
    if (res.status === 204) return [];
    return res.json();
  }

  return {
    async select(table, query = "") {
      return request(`${table}?${query}`, { method: "GET" });
    },
    async insert(table, rows) {
      if (!rows.length) return [];
      return request(table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(rows) });
    },
    async upsert(table, rows, onConflict) {
      if (!rows.length) return [];
      return request(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(rows),
      });
    },
    async update(table, patch, filterQuery) {
      return request(`${table}?${filterQuery}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
    },
  };
}

/**
 * Verify a bearer token belongs to a signed-in Supabase user who is a
 * member of analytics_admins. Returns the user id on success, throws
 * (with an http status attached) otherwise.
 */
export async function requireAdmin(authorizationHeader) {
  const token = (authorizationHeader ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Missing bearer token."), { status: 401 });

  const url = supabaseUrl();
  const anonKey = envAny(["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) throw Object.assign(new Error("Invalid or expired session."), { status: 401 });
  const user = await userRes.json();

  const admin = serviceClient();
  const rows = await admin.select("analytics_admins", `user_id=eq.${user.id}&select=user_id`);
  if (!rows.length) throw Object.assign(new Error("Not an approved studio account."), { status: 403 });

  return user.id;
}
