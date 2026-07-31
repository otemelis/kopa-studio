import { describe, expect, it } from "vitest";
import { resolveAccessDecision } from "./access-control";

describe("Tools access decision", () => {
  it("sends an unauthenticated request to login without checking membership", () => {
    expect(resolveAccessDecision({ userId: null, membershipChecked: false })).toBe("login");
  });

  it("requires a membership check for a signed-in user", () => {
    expect(resolveAccessDecision({ userId: "owner", membershipChecked: false })).toBe("check_membership");
  });

  it("allows only the matching approved membership", () => {
    expect(resolveAccessDecision({
      userId: "owner",
      membershipChecked: true,
      membershipUserId: "owner",
    })).toBe("allow");
  });

  it("rejects a signed-in user without an approved membership", () => {
    expect(resolveAccessDecision({
      userId: "not-approved",
      membershipChecked: true,
      membershipUserId: null,
    })).toBe("unauthorized");
  });

  it("rejects a mismatched membership and fails closed on lookup error", () => {
    expect(resolveAccessDecision({
      userId: "not-approved",
      membershipChecked: true,
      membershipUserId: "owner",
    })).toBe("unauthorized");
    expect(resolveAccessDecision({
      userId: "owner",
      membershipChecked: true,
      membershipUserId: "owner",
      membershipError: true,
    })).toBe("unauthorized");
  });
});
