export function StatusBadge({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();
  const tone = ["ok", "success", "completed", "active", "configured", "ready", "enabled", "receiving"].includes(normalized)
    ? "good"
    : ["failed", "error", "attention", "blocked", "stale"].includes(normalized)
      ? "bad"
      : ["partial", "waiting", "pending", "warning", "incomplete", "not installed"].includes(normalized)
        ? "warning"
        : "neutral";
  return <span className={`badge ${tone}`}>{status}</span>;
}
