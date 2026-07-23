"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function QueueAppleAdsCampaignSync({ connectionId }: { connectionId: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function call(url: string, body?: object) {
    setPending(true);
    const response = await fetch(url, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    setPending(false);
    setMessage(response.ok ? (result.status === "completed" ? `Imported ${result.campaigns} campaign(s).` : "Apple Ads campaign import queued.") : result.error ?? "Could not run Apple Ads campaign import.");
    if (response.ok) router.refresh();
  }
  return <div className="button-stack"><button className="primary compact" disabled={pending} onClick={() => call("/api/apple-ads/sync/campaigns", { connectionId })}>{pending ? "Working..." : "Queue Apple Ads campaign import"}</button><button className="secondary compact" disabled={pending} onClick={() => call("/api/apple-ads/sync/run-owner")}>Run queued campaign import now</button>{message ? <p className={message.startsWith("Imported") || message.startsWith("Apple") ? "data-note" : "error"}>{message}</p> : null}</div>;
}
