import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { AppleAdsApiV5Provider } from "@/lib/apple-ads/apple-ads-provider";

export async function POST() {
  await requireOwner();
  const result = await new AppleAdsApiV5Provider().testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
