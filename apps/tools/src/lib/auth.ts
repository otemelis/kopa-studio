import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/domain";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: membership, error } = await admin
    .from("analytics_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !membership) redirect("/unauthorized");
  return { id: user.id, email: user.email ?? "", role: "owner" as Role };
});

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/unauthorized");
  return user;
}
