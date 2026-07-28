"use client";
import { apiError, readApiPayload } from "@/lib/client-api";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunAppleAdsStructureSync() { const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const router = useRouter(); async function run() { setPending(true); setMessage(""); try { const response = await fetch("/api/apple-ads/sync/structure", { method: "POST" }); const data = await readApiPayload(response); setMessage(response.ok ? `Imported ${data.adGroups ?? 0} ad groups, ${data.keywords ?? 0} keywords, and ${data.negativeKeywords ?? 0} negatives.` : apiError(data, "Could not import Apple Ads structure.")); if (response.ok) router.refresh(); } catch { setMessage("The structure import could not reach the server. Try again."); } finally { setPending(false); } } return <div><button className="secondary compact" disabled={pending} onClick={run}>{pending ? "Importing..." : "Import Apple Ads structure"}</button>{message ? <p className={message.startsWith("Imported") ? "data-note" : "error"}>{message}</p> : null}</div>; }
