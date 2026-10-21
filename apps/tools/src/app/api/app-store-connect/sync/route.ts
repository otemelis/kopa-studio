import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/auth";

type SyncAction = "sync_analytics" | "sync_sales";

function isSyncAction(value: unknown): value is SyncAction {
  return value === "sync_analytics" || value === "sync_sales";
}

const appStoreConnectUrl = () => process.env.ASO_APPSTORE_CONNECT_URL ?? "https://www.kopa.studio/api/aso/appstore-connect";

export async function POST(request: Request) {
  await requireOwner();
  const { action } = await request.json().catch(() => ({}));
  if (!isSyncAction(action)) return NextResponse.json({ error: "Unknown App Store Connect sync action." }, { status: 400 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured for Tools." }, { status: 503 });

  const upstream = await fetch(appStoreConnectUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
    cache: "no-store",
  });
  const body = await upstream.json().catch(() => ({ error: "App Store Connect sync returned an unreadable response." }));
  return NextResponse.json(body, { status: upstream.status });
}
