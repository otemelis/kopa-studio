import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateKeywordSchema, uuidParam } from "@/validators/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  await requireOwner(); const id = uuidParam.safeParse((await params).linkId); const body = updateKeywordSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid keyword update." }, { status: 400 });
  const db = createAdminClient(); const { data: link, error: linkError } = await db.from("aso_app_keywords").select("id,keyword_id").eq("id", id.data).maybeSingle();
  if (linkError || !link) return NextResponse.json({ error: "Keyword assignment not found." }, { status: 404 });
  const { error: keywordError } = await db.from("aso_keywords").update({ term: body.data.term.toLowerCase(), country: body.data.country }).eq("id", link.keyword_id);
  if (keywordError) return NextResponse.json({ error: "Could not update keyword text. It may duplicate an existing term in this country." }, { status: 409 });
  const { error: updateError } = await db.from("aso_app_keywords").update({ priority: body.data.priority, status: body.data.status, updated_at: new Date().toISOString() }).eq("id", id.data);
  if (updateError) return NextResponse.json({ error: "Could not update keyword settings." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ linkId: string }> }) {
  await requireOwner(); const id = uuidParam.safeParse((await params).linkId); if (!id.success) return NextResponse.json({ error: "Invalid keyword assignment." }, { status: 400 });
  const db = createAdminClient(); const { data: link, error: linkError } = await db.from("aso_app_keywords").select("keyword_id").eq("id", id.data).maybeSingle();
  if (linkError || !link) return NextResponse.json({ error: "Keyword assignment not found." }, { status: 404 });
  const { error } = await db.from("aso_app_keywords").delete().eq("id", id.data); if (error) return NextResponse.json({ error: "Could not stop tracking this keyword." }, { status: 500 });
  const { count } = await db.from("aso_app_keywords").select("id", { count: "exact", head: true }).eq("keyword_id", link.keyword_id);
  if (count === 0) await db.from("aso_keywords").delete().eq("id", link.keyword_id);
  return NextResponse.json({ ok: true });
}
