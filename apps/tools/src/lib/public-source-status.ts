import type { SyncRun } from "@/types/domain";

export type PublicSourceStatus = {
  status: "configured" | "waiting" | "error";
  currentRun: SyncRun | null;
  lastSuccessfulRun: SyncRun | null;
  lastFailureRun: SyncRun | null;
  lastFailureRecovered: boolean;
};

function isPublicRun(run: SyncRun) {
  return run.provider.trim().toLowerCase() === "apple_public";
}

function timestamp(run: SyncRun) {
  return Date.parse(run.startedAt);
}

export function resolvePublicSourceStatus(runs: SyncRun[]): PublicSourceStatus {
  const relevant = runs.filter(isPublicRun).sort((left, right) => timestamp(right) - timestamp(left));
  const currentRun = relevant[0] ?? null;
  const lastSuccessfulRun = relevant.find((run) => run.status === "ok") ?? null;
  const lastFailureRun = relevant.find((run) => run.status === "failed" || run.status === "partial") ?? null;
  const lastFailureRecovered = Boolean(
    lastSuccessfulRun &&
    lastFailureRun &&
    timestamp(lastSuccessfulRun) > timestamp(lastFailureRun),
  );
  const status: PublicSourceStatus["status"] = !currentRun
    ? "waiting"
    : currentRun.status === "ok"
      ? "configured"
      : currentRun.status === "running"
        ? "waiting"
        : "error";
  return {
    status,
    currentRun,
    lastSuccessfulRun,
    lastFailureRun,
    lastFailureRecovered,
  };
}
