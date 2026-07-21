import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { experimentSchema, uuidParam } from "@/validators/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { await requireOwner(); const id = uuidParam.safeParse((await params).id); const parsed = experimentSchema.safeParse(await request.json().catch(() => null)); if (!id.success || !parsed.success) return NextResponse.json({ error: "Invalid experiment update." }, { status: 400 }); const value = parsed.data; const { error } = await createAdminClient().from("aso_experiments").update({ title: value.title, hypothesis: value.hypothesis ?? null, change_type: value.changeType, country: value.country, target_metric: value.targetMetric, start_date: value.startDate ?? null, status: value.status, result: value.result ?? null, conclusion: value.conclusion ?? null, next_action: value.nextAction ?? null, updated_at: new Date().toISOString() }).eq("id", id.data); if (error) return NextResponse.json({ error: "Could not save experiment." }, { status: 500 }); return NextResponse.json({ ok: true }); }
