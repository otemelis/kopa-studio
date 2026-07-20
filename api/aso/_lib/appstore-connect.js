import { createSign } from "node:crypto";

const API_ROOT = "https://api.appstoreconnect.apple.com";
const TOKEN_LIFETIME_SECONDS = 5 * 60;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in Vercel environment variables.`);
  return value;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function privateKey() {
  return requiredEnv("APP_STORE_CONNECT_PRIVATE_KEY").replace(/\\n/g, "\n").trim();
}

export function hasAppStoreConnectConfig() {
  return Boolean(process.env.APP_STORE_CONNECT_ISSUER_ID && process.env.APP_STORE_CONNECT_KEY_ID && process.env.APP_STORE_CONNECT_PRIVATE_KEY);
}

export function createAppStoreConnectToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: requiredEnv("APP_STORE_CONNECT_KEY_ID"), typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: requiredEnv("APP_STORE_CONNECT_ISSUER_ID"),
      iat: now,
      exp: now + TOKEN_LIFETIME_SECONDS,
      aud: "appstoreconnect-v1",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key: privateKey(), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${unsigned}.${signature}`;
}

function formatApiError(status, body) {
  const first = body?.errors?.[0];
  const detail = first?.title || first?.detail || "Request rejected by App Store Connect.";
  return new Error(`App Store Connect ${status}: ${detail}`);
}

export async function listAppStoreConnectApps() {
  const token = createAppStoreConnectToken();
  const params = new URLSearchParams({
    limit: "200",
    "fields[apps]": "name,bundleId,sku,primaryLocale",
  });
  const response = await fetch(`${API_ROOT}/v1/apps?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw formatApiError(response.status, body);
  return (body?.data ?? []).map((app) => ({
    id: app.id,
    name: app.attributes?.name ?? "Unnamed app",
    bundleId: app.attributes?.bundleId ?? null,
    sku: app.attributes?.sku ?? null,
    primaryLocale: app.attributes?.primaryLocale ?? null,
  }));
}
