import Link from "next/link";
import type { buildPoisReport } from "@/lib/pois-live/report";
import styles from "./pois-live.module.css";

type Report = ReturnType<typeof buildPoisReport>;
const number = (value: number) => value.toLocaleString("en-GB");

export function PoisLive({ report, days }: { report: Report; days: 7 | 28 }) {
  const first = report.journey[0]?.installations ?? 0;
  const maxDaily = Math.max(1, ...report.daily.map((day) => day.installations));
  return <div className={styles.workspace}>
    <div className={styles.heading}>
      <div><p className="eyebrow">POIS · Product Analytics</p><h2>Observed product journey</h2>
        <p>Live Supabase telemetry · {report.channel === "appstore" ? "App Store production" : "TestFlight testing"} · UTC event time</p></div>
      <form action="/analytics" className={styles.filters}>
        <label>Build channel<select name="channel" defaultValue={report.channel}><option value="appstore">App Store</option><option value="testflight">TestFlight</option></select></label>
        <label>Period<select name="days" defaultValue={days}><option value="7">Last 7 days</option><option value="28">Last 28 days</option></select></label>
        <input type="hidden" name="app" value="pois" /><button type="submit">Apply</button>
      </form>
    </div>
    <p className={styles.provenance}>Source: private Supabase POIS events · {report.since.slice(0, 16).replace("T", " ")}–{report.until.slice(0, 16).replace("T", " ")} UTC · Last received: {report.latestReceivedAt ? report.latestReceivedAt.replace("T", " ").slice(0, 19) + " UTC" : "No events in period"}</p>
    {report.channel === "testflight" && <div className={styles.notice}>TestFlight is testing activity. It is separate from App Store customer behavior.</div>}
    {!report.eventCount && <div className={styles.notice}>No {report.channel === "appstore" ? "App Store" : "TestFlight"} events were observed in this period. This is not a download or revenue count.</div>}
    <div className={styles.metrics}>
      <Metric label="Active installations" value={number(report.installationCount)} note="Distinct installation IDs with an event" />
      <Metric label="Observed sessions" value={number(report.observedSessions)} note="Distinct non-null session IDs" />
      <Metric label="Paywall viewers" value={number(report.paywallViews)} note="Distinct installation IDs · client event" />
      <Metric label="Purchase completions" value={number(report.purchaseCompletions)} note="Client signal · verified transactions unavailable" />
    </div>
    <div className={styles.grid}>
      <section className={styles.card}><h3>Journey from app open</h3><p>Ordered events for the same installation inside this period. Each step counts distinct installations.</p>
        <div className={styles.journey}>{report.journey.map((step, index) => <div className={styles.step} key={step.name}>
          <span>{index + 1}</span><div><strong>{step.label}</strong><small>{first && index ? `${Math.round(step.installations / first * 100)}% of observed opens` : index ? "No observed conversion denominator" : "Entry installations"}</small></div>
          <div className={styles.track}><i style={{ width: `${first ? step.installations / first * 100 : 0}%` }} /></div><b>{number(step.installations)}</b>
        </div>)}</div>
        <p className={styles.footnote}>A missing session ending may mean the app was closed or collection was interrupted. No completion is inferred.</p>
      </section>
      <section className={styles.card}><h3>Daily active installations</h3><p>Distinct installations by UTC event day. The same installation may appear on multiple days.</p>
        {report.daily.length ? <div className={styles.chart}>{report.daily.map((day) => <div key={day.date} title={`${day.date}: ${day.installations}`}><i style={{ height: `${day.installations / maxDaily * 100}%` }} /><span>{day.date.slice(5)}</span></div>)}</div> : <p className={styles.empty}>No daily activity to chart.</p>}
        <div className={styles.quality}><strong>Retention</strong><span>Unavailable until production first launches have mature follow-up days and complete event coverage.</span></div>
        <div className={styles.quality}><strong>Verified revenue</strong><span>Unavailable. Client purchase events are not App Store transactions or proceeds.</span></div>
      </section>
    </div>
    <section className={styles.card}><div className={styles.heading}><div><h3>Event explorer</h3><p>Actual event counts and distinct installations, by event name.</p></div><span>{report.eventCount} observed events · {report.versions.length ? `versions ${report.versions.join(", ")}` : "version unavailable"}</span></div>
      <div className="table-wrap"><table><thead><tr><th>Event</th><th>Events</th><th>Installations</th></tr></thead><tbody>{report.events.map((row) => <tr key={row.name}><td>{row.name.replaceAll("_", " ")}</td><td>{number(row.events)}</td><td>{number(row.installations)}</td></tr>)}</tbody></table></div>
    </section>
    <p className={styles.footnote}>This page measures POIS client events, not App Store downloads. Production and TestFlight are never combined. <Link href="/analytics?app=innertype">Open the existing InnerType analytics view →</Link></p>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
