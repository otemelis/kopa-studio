import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { listAppleAdsConnections, saveAppleAdsConnection } from "@/repositories/apple-ads-repository";
import { appleAdsConnectionSchema } from "@/validators/api";

export async function GET() { const user = await requireOwner(); return NextResponse.json({ data: await listAppleAdsConnections(user.id) }); }
export async function POST(request: Request) { const user = await requireOwner(); const parsed = appleAdsConnectionSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid Apple Ads connection." }, { status: 400 }); try { return NextResponse.json({ data: await saveAppleAdsConnection(user.id, parsed.data) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save Apple Ads connection." }, { status: 500 }); } }
