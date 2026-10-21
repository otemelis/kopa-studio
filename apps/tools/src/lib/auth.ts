import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveAccessDecision } from "@/lib/access-control";
import type { Role } from "@/types/domain";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initialDecision = resolveAccessDecision({ userId: user?.id ?? null, membershipChecked: false });
  if (initialDecision === "login") redirect("/login");
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: membership, error } = await admin
    .from("analytics_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const decision = resolveAccessDecision({
    userId: user.id,
    membershipChecked: true,
    membershipUserId: membership?.user_id ?? null,
    membershipError: Boolean(error),
  });
  if (decision !== "allow") redirect("/unauthorized");
  return { id: user.id, email: user.email ?? "", role: "owner" as Role };
});

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/unauthorized");
  return user;
}
