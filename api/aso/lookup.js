// POST /api/aso/lookup — proxies Apple's public app lookup, used by the
// console's "add app" flow. Needed server-side for two reasons: the CSP
// (`connect-src 'self' https://*.supabase.co`) doesn't allow the browser to
// fetch itunes.apple.com directly, and that endpoint doesn't send CORS
// headers for arbitrary origins anyway.
//
// Gated behind the same analytics_admins check as writes, even though it
// doesn't touch Supabase — it's still part of the private console and
// shouldn't be an open proxy anyone can hit.

import { lookupApp, parseAppleAppId } from "./_lib/providers.js";
import { requireAdmin } from "./_lib/supabase.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await requireAdmin(request.headers.authorization);
  } catch (error) {
    response.status(error.status ?? 401).json({ error: error.message });
    return;
  }

  const { input, country } = request.body ?? {};
  const storeAppId = parseAppleAppId(String(input ?? ""));
  if (!storeAppId) {
    response.status(400).json({ error: "Enter an App Store URL (…/app/idXXXXXXXX) or a numeric app id." });
    return;
  }

  try {
    const meta = await lookupApp(storeAppId, String(country || "us").toLowerCase());
    if (!meta) {
      response.status(404).json({ error: `No app found for id ${storeAppId} in that storefront.` });
      return;
    }
    response.status(200).json({ meta });
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "Apple lookup failed." });
  }
}
