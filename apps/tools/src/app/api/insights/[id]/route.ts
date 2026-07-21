import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { insightActionSchema, uuidParam } from "@/validators/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireOwner(); const id = uuidParam.safeParse((await params).id); const body = insightActionSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid insight action." }, { status: 400 });
  const now = new Date(); const patch = { status: body.data.action, updated_at: now.toISOString(), snoozed_until: body.data.action === "snoozed" ? new Date(now.getTime() + 14 * 86_400_000).toISOString() : null };
  const { error } = await createAdminClient().from("aso_insights").update(patch).eq("id", id.data).eq("status", "active");
  if (error) return NextResponse.json({ error: "Could not update this insight." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
