import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCompetitorSchema } from "@/validators/api";
import { lookupAppleApp } from "@/services/apple-lookup-service";

export async function POST(request: Request) {
  await requireOwner(); const parsed = createCompetitorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid competitor." }, { status: 400 });
  const db = createAdminClient(); const { data: app } = await db.from("aso_apps").select("id").eq("id", parsed.data.appId).maybeSingle();
  if (!app) return NextResponse.json({ error: "Tracked app not found." }, { status: 404 });
  const competitor = await lookupAppleApp(parsed.data.input, parsed.data.country);
  const { data, error } = await db.from("aso_competitors").upsert({ app_id: parsed.data.appId, platform: "ios", store_app_id: competitor.storeAppId, name: competitor.name, icon_url: competitor.iconUrl }, { onConflict: "app_id,platform,store_app_id" }).select("id,name").single();
  if (error) return NextResponse.json({ error: "Could not save competitor." }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
