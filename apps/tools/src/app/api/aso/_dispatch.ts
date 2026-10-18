import { NextResponse } from "next/server";

type CollectionScope = "rankings" | "maintenance";

export async function dispatchCollection(request: Request, scope: CollectionScope) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const endpoint = new URL(process.env.ASO_COLLECTOR_URL ?? "https://www.kopa.studio/api/aso/collect");
  endpoint.searchParams.set("scope", scope);
  try {
    const upstream = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      cache: "no-store",
    });
    const body = await upstream.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Collector returned an invalid response." }, { status: 502 });
    return NextResponse.json(body, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Collector request failed." }, { status: 502 });
  }
}
