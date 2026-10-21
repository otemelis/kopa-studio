import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createReviewPack } from "@/services/review-pack-service";

export const maxDuration = 60;
const schema = z.object({ appId: z.string().uuid(), market: z.string().trim().min(2).max(12), startDate: z.string().date(), endDate: z.string().date(), includeComparisonMarkets: z.boolean().default(false), includeRawSourceRows: z.boolean().default(false) }).refine((value) => value.startDate <= value.endDate, { message: "Start date must be before end date." });

export async function POST(request: Request) {
  await requireOwner();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid export scope." }, { status: 400 });
  try { const pack = await createReviewPack(parsed.data); return new Response(pack.archive, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${pack.filename}"`, "Cache-Control": "no-store" } }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not create review pack." }, { status: 500 }); }
}
