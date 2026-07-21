import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAppleAdsStructure } from "@/services/apple-ads-structure-sync-service";
export async function POST() { const user=await requireOwner(); const db=createAdminClient(); const {data:connection}=await db.from("apple_ads_connections").select("id,apple_ads_org_id").eq("owner_user_id",user.id).limit(1).maybeSingle(); if(!connection)return NextResponse.json({error:"No Apple Ads connection found."},{status:404}); try { return NextResponse.json({status:"completed",...(await syncAppleAdsStructure(connection.id,connection.apple_ads_org_id))}); } catch(cause) { return NextResponse.json({error:cause instanceof Error?cause.message:"Structure sync failed."},{status:500}); } }
