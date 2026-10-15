import {NextResponse} from 'next/server';
import {requireOwner} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {AppleAdsApiV5Provider} from '@/lib/apple-ads/apple-ads-provider';
import {exportScope,validateCampaignExport} from '@/lib/apple-ads/read-only-export';
export const maxDuration=60;
export async function GET(request:Request){
 const user=await requireOwner(); // Existing owner authentication; no public or new credentials.
 const url=new URL(request.url);let scope;try{scope=exportScope(url.searchParams.get('start'),url.searchParams.get('end'));}catch{return NextResponse.json({error:'Use 1–28 complete UTC days within the last 28 days.'},{status:400});}
 const db=createAdminClient();
 const connection=await db.from('apple_ads_connections').select('id,apple_ads_org_id').eq('owner_user_id',user.id).limit(2);
 if(connection.error||connection.data?.length!==1)return NextResponse.json({error:'Exactly one existing owner connection is required.'},{status:409});
 const c=connection.data[0];const campaigns=await db.from('apple_ads_campaigns').select('apple_campaign_id,name,adam_id').eq('connection_id',c.id).eq('is_deleted',false).limit(11);
 if(campaigns.error||!campaigns.data?.length||campaigns.data.length>10)return NextResponse.json({error:'Bounded campaign list unavailable (1–10 required). No export produced.'},{status:409});
 const provider=new AppleAdsApiV5Provider();const reports=[];let failureStage:'provider_request'|'report_validation'='provider_request';
 try{for(const campaign of campaigns.data){if(!/^\d+$/.test(campaign.apple_campaign_id))throw Error('Invalid campaign');failureStage='provider_request';const r=await provider.fetchCampaignReport(c.apple_ads_org_id,campaign.apple_campaign_id,scope.start,scope.end);failureStage='report_validation';reports.push({...validateCampaignExport(r.raw,campaign.apple_campaign_id,scope),campaignName:campaign.name,appStoreId:campaign.adam_id});}}
 catch{return NextResponse.json({error:'Provider report failed or violated the export contract. No partial export or substitute data returned.',failureStage},{status:502,headers:{'Cache-Control':'no-store'}});}
 return NextResponse.json({source:'Apple Ads legacy v5 report (existing provider)',scope,queriedAt:new Date().toISOString(),grain:'campaign/day/all campaign markets',campaignCoverage:'Existing owner-mapped nondeleted stored campaigns only; current account inventory is not refreshed',reports,measurement:'Apple Ads attributed installs, not verified purchases or people',databaseWrites:0},{headers:{'Cache-Control':'no-store'}});
}
