import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAppleAdsEvidenceAssessment } from "@/services/apple-ads-evidence-assessment-service";
import { syncCampaignReport, syncSearchTermReport } from "@/services/apple-ads-report-sync-service";

export const maxDuration = 300;

const date = (value: Date) => value.toISOString().slice(0, 10);
const messageOf = (cause: unknown) => cause instanceof Error ? cause.message : "Unknown Apple Ads report error.";

export async function POST() {
  const user = await requireOwner();
  const db = createAdminClient();
  const { data: connection, error: connectionError } = await db.from("apple_ads_connections").select("id,apple_ads_org_id").eq("owner_user_id", user.id).limit(1).maybeSingle();
  if (connectionError) return NextResponse.json({ error: "Could not read the Apple Ads connection." }, { status: 500 });
  if (!connection) return NextResponse.json({ error: "No Apple Ads connection found." }, { status: 404 });

  const { data: campaigns, error: campaignsError } = await db.from("apple_ads_campaigns").select("id,apple_campaign_id,name").eq("connection_id", connection.id).eq("is_deleted", false);
  if (campaignsError) return NextResponse.json({ error: "Could not read imported Apple Ads campaigns." }, { status: 500 });
  if (!campaigns?.length) return NextResponse.json({ error: "No imported campaigns found. Import Apple Ads structure first, then run the 7-day performance import." }, { status: 409 });

  const end = new Date();
  const start = new Date(Date.now() - 6 * 86_400_000);
  let rows = 0;
  let searchTerms = 0;
  let recommendations = 0;
  const failures: string[] = [];

  for (const campaign of campaigns) {
    const input = { connectionId: connection.id, organizationId: connection.apple_ads_org_id, campaignId: campaign.apple_campaign_id, campaignRowId: campaign.id, startDate: date(start), endDate: date(end) };
    let complete = true;
    try { rows += (await syncCampaignReport(input)).rows; } catch (cause) { complete = false; failures.push(`${campaign.name ?? campaign.apple_campaign_id}: campaign report - ${messageOf(cause)}`); }
    try { searchTerms += (await syncSearchTermReport(input)).rows; } catch (cause) { complete = false; failures.push(`${campaign.name ?? campaign.apple_campaign_id}: search terms - ${messageOf(cause)}`); }
    try { recommendations += (await generateAppleAdsEvidenceAssessment({ connectionId: connection.id, campaignRowId: campaign.id, completeness: complete ? "complete" : "partial" })).activeRecommendations; } catch (cause) { failures.push(`${campaign.name ?? campaign.apple_campaign_id}: evidence assessment - ${messageOf(cause)}`); }
  }

  const status = failures.length ? "partial" : "completed";
  return NextResponse.json({ status, rows, searchTerms, recommendations, campaigns: campaigns.length, failures, message: failures.length ? `${failures.length} import step${failures.length === 1 ? "" : "s"} failed. The individual errors are shown below.` : undefined }, { status: failures.length ? 207 : 200 });
}
