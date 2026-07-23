"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function QueueCollectionButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function queue() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "collection" }) });
    const body = await response.json();
    setPending(false);
    setMessage(response.ok ? body.message ?? "Keyword ranking scrape queued." : body.error ?? "Could not queue keyword ranking scrape.");
    if (response.ok) router.refresh();
  }
  return <div><button className="primary compact" disabled={pending} onClick={queue}>{pending ? "Queueing..." : "Rerun keyword ranking scrape"}</button>{message && <p className={message.startsWith("Keyword") ? "data-note" : "error"}>{message}</p>}</div>;
}
