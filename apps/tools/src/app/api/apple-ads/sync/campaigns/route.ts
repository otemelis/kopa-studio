import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidParam } from "@/validators/api";

export async function POST(request: Request) {
  const user = await requireOwner(); const body = await request.json().catch(() => null); const connectionId = uuidParam.safeParse(body?.connectionId);
  if (!connectionId.success) return NextResponse.json({ error: "Invalid Apple Ads connection." }, { status: 400 });
  const db = createAdminClient(); const { data: connection } = await db.from("apple_ads_connections").select("id").eq("id", connectionId.data).eq("owner_user_id", user.id).maybeSingle();
  if (!connection) return NextResponse.json({ error: "Apple Ads connection was not found." }, { status: 404 });
  const { data, error } = await db.from("apple_ads_sync_runs").insert({ connection_id: connection.id, resource_type: "campaigns", status: "queued" }).select("id").single();
  if (error?.code === "23505") return NextResponse.json({ error: "A campaign sync is already queued or running." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Could not queue campaign sync." }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
