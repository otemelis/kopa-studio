import { describe, expect, it } from "vitest";
import { resolvePublicSourceStatus } from "./public-source-status";
import type { SyncRun } from "@/types/domain";

function run(input: Partial<SyncRun> & Pick<SyncRun, "id" | "status" | "startedAt">): SyncRun {
  return {
    provider: "apple_public",
    trigger: "manual",
    finishedAt: input.status === "running" ? null : input.startedAt,
    processed: 54,
    succeeded: input.status === "ok" ? 54 : 0,
    failed: input.status === "failed" ? 54 : 0,
    error: input.status === "failed" ? "Collector failed" : null,
    ...input,
  };
}

describe("Public App Store source status", () => {
  it("shows configured after a later success while retaining the recovered failure", () => {
    const failure = run({ id: "failed", status: "failed", startedAt: "2026-07-31T00:52:00.000Z" });
    const success = run({ id: "success", status: "ok", startedAt: "2026-07-31T07:28:00.000Z" });

    expect(resolvePublicSourceStatus([failure, success])).toEqual({
      status: "configured",
      currentRun: success,
      lastSuccessfulRun: success,
      lastFailureRun: failure,
      lastFailureRecovered: true,
    });
  });

  it("shows error when a failure follows an older success", () => {
    const success = run({ id: "success", status: "ok", startedAt: "2026-07-31T00:57:00.000Z" });
    const failure = run({ id: "failed", status: "failed", startedAt: "2026-07-31T07:28:00.000Z" });

    expect(resolvePublicSourceStatus([success, failure])).toMatchObject({
      status: "error",
      currentRun: failure,
      lastSuccessfulRun: success,
      lastFailureRun: failure,
      lastFailureRecovered: false,
    });
  });

  it("treats a latest partial run as the current error while retaining older freshness", () => {
    const success = run({ id: "success", status: "ok", startedAt: "2026-07-31T00:57:00.000Z" });
    const partial = run({ id: "partial", status: "partial", startedAt: "2026-07-31T07:28:00.000Z", failed: 2 });

    expect(resolvePublicSourceStatus([success, partial])).toMatchObject({
      status: "error",
      currentRun: partial,
      lastSuccessfulRun: success,
      lastFailureRun: partial,
      lastFailureRecovered: false,
    });
  });

  it("shows waiting for a running latest collection and keeps the last successful freshness", () => {
    const success = run({ id: "success", status: "ok", startedAt: "2026-07-31T00:57:00.000Z" });
    const running = run({ id: "running", status: "running", startedAt: "2026-07-31T07:28:00.000Z" });

    expect(resolvePublicSourceStatus([success, running])).toMatchObject({
      status: "waiting",
      currentRun: running,
      lastSuccessfulRun: success,
    });
  });

  it("shows waiting when no relevant public run exists", () => {
    expect(resolvePublicSourceStatus([
      run({ id: "other", provider: "appstore_connect", status: "ok", startedAt: "2026-07-31T07:28:00.000Z" }),
    ])).toEqual({
      status: "waiting",
      currentRun: null,
      lastSuccessfulRun: null,
      lastFailureRun: null,
      lastFailureRecovered: false,
    });
  });

  it("sorts by run time rather than trusting input order", () => {
    const older = run({ id: "older", status: "failed", startedAt: "2026-07-31T00:52:00.000Z" });
    const newer = run({ id: "newer", status: "ok", startedAt: "2026-07-31T07:28:00.000Z" });

    expect(resolvePublicSourceStatus([older, newer]).currentRun?.id).toBe("newer");
    expect(resolvePublicSourceStatus([newer, older]).currentRun?.id).toBe("newer");
  });
});
