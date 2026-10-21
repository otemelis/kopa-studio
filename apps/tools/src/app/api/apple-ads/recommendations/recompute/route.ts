import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAppleAdsEvidenceAssessment } from "@/services/apple-ads-evidence-assessment-service";

export const maxDuration = 300;

const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : "Unknown assessment error.";

export async function POST() {
  const user = await requireOwner();
  const db = createAdminClient();
  const { data: connection, error: connectionError } = await db
    .from("apple_ads_connections")
    .select("id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (connectionError) return NextResponse.json({ error: "Could not read the Apple Ads connection." }, { status: 500 });
  if (!connection) return NextResponse.json({ error: "No Apple Ads connection found." }, { status: 404 });

  const { data: campaigns, error: campaignError } = await db
    .from("apple_ads_campaigns")
    .select("id,name")
    .eq("connection_id", connection.id)
    .eq("is_deleted", false);
  if (campaignError) return NextResponse.json({ error: "Could not read imported Apple Ads campaigns." }, { status: 500 });

  let recommendations = 0;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const failures: string[] = [];
  for (const campaign of campaigns ?? []) {
    try {
      const result = await generateAppleAdsEvidenceAssessment({ connectionId: connection.id, campaignRowId: campaign.id });
      recommendations += result.activeRecommendations;
      inserted += result.inserted;
      updated += result.updated;
      unchanged += result.unchanged;
    } catch (cause) {
      failures.push(`${campaign.name}: ${messageOf(cause)}`);
    }
  }

  return NextResponse.json({
    status: failures.length ? "partial" : "completed",
    campaigns: campaigns?.length ?? 0,
    recommendations,
    inserted,
    updated,
    unchanged,
    failures,
  }, { status: failures.length ? 207 : 200 });
}
