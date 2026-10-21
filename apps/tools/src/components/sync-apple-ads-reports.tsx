"use client";

import { apiError, readApiPayload } from "@/lib/client-api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncAppleAdsReports() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "warning" | "error">("success");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function sync() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/apple-ads/reports/campaigns", { method: "POST" });
      const data = await readApiPayload(response);
      if (!response.ok) {
        setTone("error");
        setMessage(apiError(data, "Could not import Apple Ads performance reports."));
        return;
      }
      const summary = `Imported ${data.rows ?? 0} daily report rows, ${data.searchTerms ?? 0} search-term rows, and refreshed ${data.recommendations ?? 0} recommendations.`;
      if (data.status === "partial") {
        const failures = Array.isArray(data.failures) ? data.failures.filter((value): value is string => typeof value === "string") : [];
        setTone("warning");
        setMessage(`${summary} ${typeof data.message === "string" ? data.message : "Some campaign data could not be imported."}${failures.length ? ` ${failures.join(" ")}` : ""}`);
      } else {
        setTone("success");
        setMessage(summary);
      }
      router.refresh();
    } catch {
      setTone("error");
      setMessage("The import request could not reach the server. Try again, then check Recent jobs if it keeps failing.");
    } finally {
      setPending(false);
    }
  }

  return <div><button className="secondary compact" disabled={pending} onClick={sync}>{pending ? "Importing..." : "Import Apple Ads last 7 days"}</button>{message ? <p className={`sync-message ${tone}`}>{message}</p> : null}</div>;
}
