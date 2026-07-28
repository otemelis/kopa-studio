"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiError, readApiPayload } from "@/lib/client-api";
export function QueueCollectionButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function queue() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "collection" }) });
      const body = await readApiPayload(response);
      setMessage(response.ok ? typeof body.message === "string" ? body.message : "Keyword ranking scrape queued." : apiError(body, "Could not queue keyword ranking scrape."));
      if (response.ok) router.refresh();
    } catch {
      setMessage("The queue request could not reach the server. Try again.");
    } finally { setPending(false); }
  }
  return <div><button className="primary compact" disabled={pending} onClick={queue}>{pending ? "Queueing..." : "Rerun keyword ranking scrape"}</button>{message && <p className={message.startsWith("Keyword") ? "data-note" : "error"}>{message}</p>}</div>;
}
