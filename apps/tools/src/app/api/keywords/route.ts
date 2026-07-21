import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createKeywordSchema } from "@/validators/api";

export async function POST(request: Request) {
  await requireOwner();
  const parsed = createKeywordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid keyword." }, { status: 400 });
  const db = createAdminClient(); const terms = [...new Set(parsed.data.terms.map((term) => term.toLowerCase()))];
  const { data: existingApp } = await db.from("aso_apps").select("id").eq("id", parsed.data.appId).maybeSingle();
  if (!existingApp) return NextResponse.json({ error: "App not found." }, { status: 404 });
  const { data: keywords, error: keywordError } = await db.from("aso_keywords").upsert(terms.map((term) => ({ term, country: parsed.data.country })), { onConflict: "term,country" }).select("id");
  if (keywordError || !keywords?.length) return NextResponse.json({ error: "Could not save keywords." }, { status: 500 });
  const { error: linkError } = await db.from("aso_app_keywords").upsert(keywords.map((keyword) => ({ app_id: parsed.data.appId, keyword_id: keyword.id, priority: parsed.data.priority, status: "active", updated_at: new Date().toISOString() })), { onConflict: "app_id,keyword_id" });
  if (linkError) return NextResponse.json({ error: "Could not assign keywords to this app." }, { status: 500 });
  return NextResponse.json({ added: terms.length }, { status: 201 });
}
