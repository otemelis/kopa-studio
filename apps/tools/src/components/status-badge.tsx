export function StatusBadge({ status }: { status: string }) {
  const tone = ["ok", "completed", "active", "configured"].includes(status) ? "good" : ["failed", "error"].includes(status) ? "bad" : "neutral";
  return <span className={`badge ${tone}`}>{status}</span>;
}
