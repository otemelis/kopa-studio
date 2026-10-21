"use client";

import { apiError, readApiPayload } from "@/lib/client-api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecomputeAppleAdsAssessment() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "warning" | "error">("success");

  async function recompute() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/apple-ads/recommendations/recompute", { method: "POST" });
      const data = await readApiPayload(response);
      if (!response.ok && response.status !== 207) {
        setTone("error");
        setMessage(apiError(data, "Could not recompute the Apple Ads assessment."));
        return;
      }
      const summary = `${data.recommendations ?? 0} active recommendations: ${data.inserted ?? 0} new, ${data.updated ?? 0} refreshed, ${data.unchanged ?? 0} unchanged.`;
      if (data.status === "partial") {
        setTone("warning");
        const failures = Array.isArray(data.failures) ? data.failures.join(" ") : "";
        setMessage(`${summary} Some campaigns could not be assessed. ${failures}`);
      } else {
        setTone("success");
        setMessage(summary);
      }
      router.refresh();
    } catch {
      setTone("error");
      setMessage("The assessment request could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return <div>
    <button className="secondary compact" disabled={pending} onClick={recompute}>{pending ? "Recomputing…" : "Recompute Apple Ads assessment"}</button>
    {message ? <p className={`sync-message ${tone}`}>{message}</p> : null}
  </div>;
}
