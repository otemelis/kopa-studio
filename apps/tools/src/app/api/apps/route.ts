import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listApps } from "@/repositories/apps-repository";
import { paginationSchema } from "@/validators/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const parsed = paginationSchema.safeParse({ limit: new URL(request.url).searchParams.get("limit") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Invalid pagination." }, { status: 400 });
  const apps = await listApps();
  return NextResponse.json({ data: apps.slice(0, parsed.data.limit) }, { headers: { "Cache-Control": "private, no-store" } });
}
