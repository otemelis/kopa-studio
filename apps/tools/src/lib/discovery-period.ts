export const DISCOVERY_PERIODS = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
} as const;

export type DiscoveryPeriod = keyof typeof DISCOVERY_PERIODS;
export type DiscoveryEvidenceWindow = { start: string | null; end: string | null };

export function resolveDiscoveryPeriod(value?: string | null): { period: DiscoveryPeriod; days: number } {
  const period = value && value in DISCOVERY_PERIODS ? value as DiscoveryPeriod : "28d";
  return { period, days: DISCOVERY_PERIODS[period] };
}

export function normalizeDiscoveryDays(value: number): number {
  return Object.values(DISCOVERY_PERIODS).includes(value as 7 | 28 | 90) ? value : DISCOVERY_PERIODS["28d"];
}

export function discoveryQueryStart(days: number, now = new Date()): string {
  const normalizedDays = normalizeDiscoveryDays(days);
  return new Date(now.getTime() - (normalizedDays - 1) * 86_400_000).toISOString().slice(0, 10);
}

export function discoveryEvidenceLabel(days: number, window: DiscoveryEvidenceWindow): string {
  const prefix = `App Store Connect Discovery & Engagement, ${normalizeDiscoveryDays(days)}-day selected window`;
  return window.start && window.end ? `${prefix} · ${window.start} to ${window.end}` : `${prefix} · evidence dates unavailable`;
}
