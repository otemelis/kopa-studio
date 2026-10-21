"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiError, readApiPayload } from "@/lib/client-api";

type Action = "sync_analytics" | "sync_sales";

export function AppStoreConnectSyncActions() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const router = useRouter();

  async function run(action: Action) {
    setPending(action);
    setMessage("");
    try {
      const response = await fetch("/api/app-store-connect/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await readApiPayload(response);
      setMessage(response.ok ? typeof result.message === "string" ? result.message : "App Store Connect sync finished." : apiError(result, "Could not run App Store Connect sync."));
      if (response.ok) router.refresh();
    } catch {
      setMessage("The sync request could not reach the server. Try again.");
    } finally { setPending(null); }
  }

  return <div className="button-stack"><button className="primary compact" disabled={pending !== null} onClick={() => run("sync_analytics")}>{pending === "sync_analytics" ? "Importing..." : "Retry Discovery report import"}</button><button className="secondary compact" disabled={pending !== null} onClick={() => run("sync_sales")}>{pending === "sync_sales" ? "Importing..." : "Import sales report"}</button>{message ? <p className={/imported|queued|already|generated/i.test(message) ? "data-note" : "error"}>{message}</p> : null}</div>;
}
