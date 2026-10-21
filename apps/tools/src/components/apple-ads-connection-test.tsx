"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = { ok: boolean; message: string; organizations: Array<{ id: string; name: string }> };

export function AppleAdsConnectionTest() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [testing, setTesting] = useState(false);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  async function test() {
    setTesting(true); setResult(null);
    const response = await fetch("/api/apple-ads/test", { method: "POST" });
    setResult(await response.json().catch(() => ({ ok: false, message: "Could not read the connection result.", organizations: [] })));
    setTesting(false);
  }
  async function save(organization: { id: string; name: string }) { setSavingOrgId(organization.id); const response = await fetch("/api/apple-ads/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appleAdsOrgId: organization.id, appleAdsOrgName: organization.name }) }); const data = await response.json().catch(() => null); setSavingOrgId(null); if (!response.ok) { setResult({ ok: false, message: data?.error ?? "Could not save the Apple Ads organization.", organizations: [] }); return; } router.refresh(); }
  return <section className="notice"><h2>Read-only connection check</h2><p>Tests OAuth and lists accessible organizations. It neither imports data nor changes campaigns.</p><button className="secondary compact" type="button" disabled={testing} onClick={test}>{testing ? "Testing…" : "Test Apple Ads connection"}</button>{result ? <div className={result.ok ? "connection-result success" : "connection-result error"}><p>{result.message}</p>{result.ok && result.organizations.length > 0 ? <ul>{result.organizations.map((organization) => <li key={organization.id}>{organization.name} · {organization.id} <button className="secondary compact" type="button" disabled={savingOrgId !== null} onClick={() => save(organization)}>{savingOrgId === organization.id ? "Saving…" : "Use this organization"}</button></li>)}</ul> : null}</div> : null}</section>;
}
