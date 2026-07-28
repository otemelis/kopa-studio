export function MetricCard({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone?: "good" | "warning" | "bad" }) {
  return <article className="metric-card" data-tone={tone}><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
