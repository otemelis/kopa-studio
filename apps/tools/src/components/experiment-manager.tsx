"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExperimentRow, ExperimentStatus } from "@/types/domain";

const statuses: ExperimentStatus[] = ["planned", "running", "monitoring", "won", "lost", "inconclusive", "reverted"];
const statusLabels: Record<ExperimentStatus, string> = {
  planned: "Logged",
  running: "Live",
  monitoring: "Watching",
  won: "Positive",
  lost: "Negative",
  inconclusive: "Inconclusive",
  reverted: "Reverted",
};
const changeTypes = [
  "metadata",
  "screenshots",
  "app_icon",
  "price",
  "campaign_activated",
  "campaign_paused",
  "bid_changed",
  "localization_added",
  "app_version_released",
  "paywall",
  "onboarding",
];
const metrics = [
  ["conversion", "Conversion"],
  ["downloads", "Downloads"],
  ["page_views", "Product page views"],
  ["impressions", "Impressions"],
];

export function ExperimentManager({ apps, experiments }: { apps: Array<{ id: string; name: string }>; experiments: ExperimentRow[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save(url: string, method: string, form: FormData) {
    setPending(true);
    setMessage("");
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: form.get("appId"),
        title: form.get("title"),
        hypothesis: blank(form.get("hypothesis")),
        changeType: form.get("changeType"),
        country: form.get("country"),
        targetMetric: form.get("targetMetric"),
        startDate: blank(form.get("startDate")),
        status: form.get("status"),
        result: blank(form.get("result")),
        conclusion: blank(form.get("conclusion")),
        nextAction: blank(form.get("nextAction")),
      }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Could not save change.");
    setMode(null);
    router.refresh();
  }

  return <>
    <div className="section-head"><h2>Logged changes</h2><button className="primary compact" onClick={() => setMode(mode === "create" ? null : "create")}>{mode === "create" ? "Close" : "Log change"}</button></div>
    {message && <p className="error">{message}</p>}
    {mode === "create" && <ChangeLogForm apps={apps} pending={pending} onSubmit={(form) => save("/api/experiments", "POST", form)} />}
    {experiments.length ? <section className="experiment-list">{experiments.map((change) => <article className="experiment-card" key={change.id}>
      <div><span className="badge neutral">{statusLabels[change.status]}</span><span className="insight-app">{change.appName} · {change.country.toUpperCase()}</span></div>
      <h2>{change.title}</h2>
      <p>{change.hypothesis ?? "No description recorded."}</p>
      <dl className="change-log-details">
        <div><dt>Change</dt><dd>{label(change.changeType)}</dd></div>
        <div><dt>Date</dt><dd>{change.startDate ?? "Not dated"}</dd></div>
        <div><dt>Watch</dt><dd>{label(change.targetMetric)}</dd></div>
        <div><dt>Expected effect</dt><dd>{change.result ?? "Not recorded"}</dd></div>
      </dl>
      {change.conclusion ? <p><strong>Outcome:</strong> {change.conclusion}</p> : null}
      {change.nextAction ? <footer>Next: {change.nextAction}</footer> : null}
      <button onClick={() => setMode(mode === change.id ? null : change.id)}>Edit</button>
      {mode === change.id && <ChangeLogForm apps={apps} experiment={change} pending={pending} onSubmit={(form) => save(`/api/experiments/${change.id}`, "PATCH", form)} />}
    </article>)}</section> : <div className="notice"><h2>No changes logged</h2><p>Log a meaningful product, listing, localization, or acquisition change before judging the movement around it.</p></div>}
  </>;
}

function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function ChangeLogForm({ apps, experiment, pending, onSubmit }: { apps: Array<{ id: string; name: string }>; experiment?: ExperimentRow; pending: boolean; onSubmit: (form: FormData) => void }) {
  return <form action={onSubmit} className="management-form">
    <label>App<select name="appId" defaultValue={experiment?.appId}>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label>
    <label>Title<input name="title" defaultValue={experiment?.title} required /></label>
    <label>Description<textarea name="hypothesis" defaultValue={experiment?.hypothesis ?? ""} placeholder="What changed, and what was the before state?" /></label>
    <label>Change type<input name="changeType" list="change-types" defaultValue={experiment?.changeType ?? "metadata"} required /></label>
    <datalist id="change-types">{changeTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</datalist>
    <label>Market<input name="country" defaultValue={experiment?.country ?? "all"} required /></label>
    <label>Metric to watch<select name="targetMetric" defaultValue={experiment?.targetMetric ?? "conversion"}>{metrics.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
    <label>Date<input name="startDate" type="date" defaultValue={experiment?.startDate ?? ""} /></label>
    <label>Status<select name="status" defaultValue={experiment?.status ?? "planned"}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
    <label>Expected effect<input name="result" defaultValue={experiment?.result ?? ""} /></label>
    <label>Outcome notes<input name="conclusion" defaultValue={experiment?.conclusion ?? ""} /></label>
    <label>Next action<input name="nextAction" defaultValue={experiment?.nextAction ?? ""} /></label>
    <button className="primary" disabled={pending}>{pending ? "Saving..." : experiment ? "Save change" : "Create change"}</button>
  </form>;
}
