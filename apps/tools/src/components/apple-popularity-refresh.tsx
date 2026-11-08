"use client";

import { useState } from "react";

export function ApplePopularityRefresh({ appId, country }: { appId: string; country: string }) {
  const [state, setState] = useState<string>("");
  const [busy, setBusy] = useState(false);
  return <div className="rank-source-bar">
    <div><strong>Apple keyword demand</strong><p>Latest published complete week · relative to Apple searches, by storefront and genre. Missing terms remain unavailable.</p></div>
    <div><button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setState("Refreshing Apple data…");
      try {
        const response = await fetch("/api/aso/apple-popularity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appId, country }) });
        const result = await response.json() as { error?: string; observed?: number; notReported?: number; weekStart?: string };
        if (!response.ok) throw new Error(result.error ?? "Refresh unavailable.");
        setState(`Apple week ${result.weekStart}: ${result.observed} terms reported, ${result.notReported} unavailable.`);
        window.location.reload();
      } catch (error) { setState(error instanceof Error ? error.message : "Refresh unavailable."); }
      finally { setBusy(false); }
    }}>{busy ? "Refreshing…" : "Refresh Apple demand"}</button><span role="status">{state}</span></div>
  </div>;
}
