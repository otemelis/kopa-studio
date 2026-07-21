"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ContextApp = { id: string; name: string; primaryCountry: string };

const periods = [
  ["7d", "Last 7 days"],
  ["28d", "Last 28 days"],
  ["90d", "Last 90 days"],
] as const;

export function GlobalContextBar({ apps, dataFreshness }: { apps: ContextApp[]; dataFreshness: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedApp = searchParams.get("app") ?? "";
  const selectedCountry = searchParams.get("country") ?? "";
  const selectedPeriod = searchParams.get("period") ?? "28d";
  const markets = [...new Set(apps.map((app) => app.primaryCountry).filter(Boolean))].sort();

  function updateContext(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return <section className="context-bar" aria-label="Global context"><label>App<select value={selectedApp} onChange={(event) => updateContext("app", event.target.value)}><option value="">All apps</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><label>Market<select value={selectedCountry} onChange={(event) => updateContext("country", event.target.value)}><option value="">All markets</option>{markets.map((market) => <option key={market} value={market}>{market.toUpperCase()}</option>)}</select></label><label>Period<select value={selectedPeriod} onChange={(event) => updateContext("period", event.target.value)}>{periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div><span>Data</span><strong>{dataFreshness}</strong></div></section>;
}
