import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { saveAppleAdsAppMapping } from "@/repositories/apple-ads-repository";
import { appleAdsAppMappingSchema } from "@/validators/api";

export async function POST(request: Request) { const user = await requireOwner(); const parsed = appleAdsAppMappingSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid Apple Ads app mapping." }, { status: 400 }); try { await saveAppleAdsAppMapping(user.id, parsed.data); return NextResponse.json({ ok: true }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save Apple Ads app mapping." }, { status: 409 }); } }
