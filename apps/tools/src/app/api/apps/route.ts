import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
import { paginationSchema } from "@/validators/api";
import { createAppSchema } from "@/validators/api";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupAppleApp } from "@/services/apple-lookup-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const parsed = paginationSchema.safeParse({ limit: new URL(request.url).searchParams.get("limit") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Invalid pagination." }, { status: 400 });
  const apps = await listApps();
  return NextResponse.json({ data: apps.slice(0, parsed.data.limit) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  await requireOwner();
  const parsed = createAppSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid app." }, { status: 400 });
  const app = await lookupAppleApp(parsed.data.input, parsed.data.country);
  const db = createAdminClient(); const now = new Date().toISOString();
  const { data, error } = await db.from("aso_apps").upsert({ platform: "ios", store_app_id: app.storeAppId, bundle_id: app.bundleId, name: app.name, developer: app.developer, description: app.description, icon_url: app.iconUrl, category: app.category, primary_country: parsed.data.country, current_version: app.currentVersion, release_notes: app.releaseNotes, rating: app.rating, rating_count: app.ratingCount, price: app.price, currency: app.currency, store_url: app.storeUrl, languages: app.languages, screenshot_urls: app.screenshotUrls, last_store_update_at: app.lastStoreUpdateAt, source: "public_store", updated_at: now }, { onConflict: "platform,store_app_id" }).select("id,name").single();
  if (error) return NextResponse.json({ error: "Could not save the app." }, { status: 500 });
  await db.from("aso_app_storefronts").upsert({ app_id: data.id, country: parsed.data.country, is_primary: true, metadata_localised: true, screenshots_localised: true }, { onConflict: "app_id,country" });
  return NextResponse.json({ data }, { status: 201 });
}
