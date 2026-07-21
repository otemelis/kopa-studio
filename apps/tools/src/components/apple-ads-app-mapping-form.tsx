"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AppleAdsAppMappingForm({ connections, apps }: { connections: Array<{ id: string; name: string }>; apps: Array<{ id: string; name: string; storeAppId: string }> }) {
  const router = useRouter(); const [message, setMessage] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function submit(form: FormData) { setSaving(true); setMessage(null); const response = await fetch("/api/apple-ads/mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: form.get("connectionId"), appId: form.get("appId"), adamId: form.get("adamId"), appleAppName: form.get("appleAppName") || undefined }) }); const result = await response.json().catch(() => null); setSaving(false); setMessage(response.ok ? "App mapping saved." : result?.error ?? "Could not save the app mapping."); if (response.ok) router.refresh(); }
  return <form className="management-form" action={submit}><label>Apple Ads organization<select name="connectionId" required>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select></label><label>Kopa app<select name="appId" required>{apps.map((app) => <option key={app.id} value={app.id}>{app.name} · current ID {app.storeAppId}</option>)}</select></label><label>Apple Adam ID<input name="adamId" inputMode="numeric" required placeholder="e.g. 123456789" /></label><label>Apple app name <span className="optional">(optional)</span><input name="appleAppName" placeholder="As shown in Apple Ads" /></label><button className="primary compact" disabled={saving} type="submit">{saving ? "Saving…" : "Save app mapping"}</button>{message ? <p className={message === "App mapping saved." ? "success" : "error"}>{message}</p> : null}</form>;
}
