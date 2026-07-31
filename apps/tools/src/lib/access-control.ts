export type AccessDecision = "login" | "check_membership" | "allow" | "unauthorized";

export function resolveAccessDecision(input: {
  userId: string | null;
  membershipChecked: boolean;
  membershipUserId?: string | null;
  membershipError?: boolean;
}): AccessDecision {
  if (!input.userId) return "login";
  if (!input.membershipChecked) return "check_membership";
  if (input.membershipError || input.membershipUserId !== input.userId) return "unauthorized";
  return "allow";
}
