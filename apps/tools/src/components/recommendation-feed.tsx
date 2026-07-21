"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";

export type RecommendationFeedItem = {
  id: string;
  source: "ASO" | "Apple Ads";
  appName: string | null;
  title: string;
  whatHappened: string;
  suggestedAction: string;
  evidence: string;
  priority: string;
  confidence: string;
  impact: string;
  effort: string;
  risk: string;
  status: string;
  createdAt: string;
  actionable: boolean;
};

export function RecommendationFeed({ items }: { items: RecommendationFeedItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  async function action(id: string, next: "completed" | "dismissed" | "snoozed") {
    if (next === "dismissed" && !confirm("Dismiss this recommendation? It remains in history but will leave the active list.")) return;
    setPending(id);
    setMessage("");
    const response = await fetch(`/api/insights/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: next }) });
    const body = await response.json();
    setPending(null);
    if (!response.ok) return setMessage(body.error ?? "Could not update recommendation.");
    router.refresh();
  }

  return <><div className="section-head"><h2>Recommendation feed</h2><span>{items.length} shown</span></div>{message ? <p className="error">{message}</p> : null}<section className="insight-list">{items.length ? items.map((item) => <article className="insight-card recommendation-card" key={`${item.source}:${item.id}`}><div className="recommendation-meta"><StatusBadge status={item.priority} /><span>{item.source}</span><span>{item.appName ?? "Portfolio"}</span><span>{item.status}</span></div><h2>{item.title}</h2><p>{item.whatHappened}</p><p><strong>Suggested action:</strong> {item.suggestedAction}</p><p><strong>Evidence:</strong> {item.evidence}</p>{!item.actionable ? <p className="data-note">This recommendation needs a constrained review before it should be treated as executable.</p> : null}<footer>Confidence: {item.confidence} · Impact: {item.impact} · Effort: {item.effort} · Risk: {item.risk}</footer>{item.actionable ? <div className="insight-actions"><button disabled={pending === item.id} onClick={() => action(item.id, "completed")}>Mark done</button><button disabled={pending === item.id} onClick={() => action(item.id, "snoozed")}>Snooze 14d</button><button disabled={pending === item.id} onClick={() => action(item.id, "dismissed")}>Dismiss</button></div> : null}</article>) : <div className="notice"><h2>No active recommendations</h2><p>No ASO or Apple Ads recommendations match this filter.</p></div>}</section></>;
}
