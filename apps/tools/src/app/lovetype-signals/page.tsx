import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";
import { readLoveTypeSource, summarizeLoveType } from "@/lib/lovetype-signals";
import styles from "./signals.module.css";

export const dynamic = "force-dynamic";

type Params = Promise<{ days?: string }>;

function utc(value: string | null) {
  return value ? `${new Date(value).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC` : "No observation";
}

function Metric({ label, value, detail, unavailable = false }: { label: string; value: string | number; detail: string; unavailable?: boolean }) {
  return <article className={styles.metric}><span>{label}</span><strong>{unavailable ? "Unavailable" : value}</strong><small>{detail}</small></article>;
}

function Bars({ title, points, color, empty }: { title: string; points: { date: string; value: number }[]; color: string; empty: string }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return <div className={styles.chart}><div className={styles.sectionTitle}><h3>{title}</h3><span>UTC event date</span></div>
    {points.length ? <div className={styles.bars}>{points.map(({ date, value }) => <div className={styles.barColumn} key={date} title={`${date}: ${value}`}>
      <b>{value}</b><div className={styles.barTrack}><i style={{ height: `${Math.max(8, value / max * 100)}%`, background: color }} /></div><time dateTime={date}>{date.slice(5)}</time>
    </div>)}</div> : <p className={styles.empty}>{empty}</p>}
  </div>;
}

function Breakdown({ title, rows, empty, note }: { title: string; rows: { label: string; count: number }[]; empty: string; note: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return <div className={styles.breakdown}><div className={styles.sectionTitle}><h3>{title}</h3><span>{note}</span></div>
    {rows.length ? rows.slice(0, 8).map((row) => <div className={styles.breakRow} key={row.label}>
      <span title={row.label}>{row.label}</span><i><b style={{ width: `${row.count / max * 100}%` }} /></i><strong>{row.count}</strong>
    </div>) : <p className={styles.empty}>{empty}</p>}
  </div>;
}

export default async function LoveTypeSignals({ searchParams }: { searchParams: Params }) {
  await requireUser();
  const { days: selected } = await searchParams;
  const days = selected === "28" ? 28 : 7;
  const [appSource, webSource] = await Promise.all([
    readLoveTypeSource("lovetype", days), readLoveTypeSource("lovetype-web", days),
  ]);
  const { app, web } = summarizeLoveType(appSource, webSource);
  return <PageShell title="LoveType · Live signals"><div className={styles.page}>
    <div className={styles.hero}><div><p className={styles.kicker}>Website + iOS app · production-tagged telemetry</p><h2>From discovery to the first test</h2>
      <p>Two live sources, two different identities. Website visits and app installations are shown side by side; they are not joined into attributed customers.</p></div>
      <div className={styles.period} aria-label="Reporting window"><Link className={days === 7 ? styles.selected : ""} href="/lovetype-signals?days=7">7 days</Link><Link className={days === 28 ? styles.selected : ""} href="/lovetype-signals?days=28">28 days</Link></div></div>

    <div className={styles.sourceStrip}><div><span className={styles.sourceDot} data-available={web.available} /> <b>Website</b><span>{web.available ? `Last received ${utc(web.lastReceived)}` : "Source unavailable"}</span></div>
      <div><span className={styles.sourceDot} data-available={app.available} /> <b>iOS app</b><span>{app.available ? `Last received ${utc(app.lastReceived)}` : "Source unavailable"}</span></div>
      <span>Rolling {days} days · UTC event time · prod only</span></div>

    <div className={styles.columns}><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>01 / Discover</p><h3>Website activity</h3></div><span>love-type.app</span></div>
      {web.available ? <><div className={styles.metrics}>
        <Metric label="Observed visits" value={web.visits} detail="Distinct temporary visit IDs with a page view" />
        <Metric label="Page views" value={web.pageViews} detail="Deduplicated page_view events" />
        <Metric label="App Store tap visits" value={web.tapVisits} detail={`${web.taps} tap events · ${web.visits ? `${Math.round(web.tapVisits / web.visits * 100)}% of observed visits` : "rate unavailable"}`} />
      </div><Bars title="Observed visits by day" points={web.dailyVisits} color="var(--web)" empty="No page-view visits observed in this period." />
        <div className={styles.twoBreakdowns}><Breakdown title="Entry referrers" rows={web.referrers} empty="No first-observed-page referrer recorded." note="Visit IDs" />
        <Breakdown title="App Store buttons" rows={web.ctas} empty="No App Store taps observed." note="Tap visits" /></div>
        <div className={styles.twoBreakdowns}><Breakdown title="Pages reached" rows={web.paths} empty="No page views observed." note="Visit IDs" />
        <Breakdown title="UTM campaigns" rows={web.campaigns} empty="No tagged landing visits observed." note="First page only" /></div>
        <div className={styles.twoBreakdowns}><Breakdown title="UTM sources" rows={web.utmSources} empty="No UTM source observed." note="First page only" />
          <div className={styles.breakdown}><div className={styles.sectionTitle}><h3>Engagement actions</h3><span>Visit IDs</span></div>
            {[["Comparison code decoded", web.compareCodeVisits], ["Pair picked", web.pairPickerVisits], ["Starter line copied", web.starterCopyVisits]].map(([label, count]) => <div className={styles.testRow} key={label}><span>{label}</span><strong>{count}</strong></div>)}
          </div></div>
      </> : <p className={styles.empty}>Website events could not be read. No zero or sample metrics are substituted.</p>}</section>

      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>02 / Engage</p><h3>iOS app activity</h3></div><span>LoveType</span></div>
      {app.available ? <><div className={styles.metrics}>
        <Metric label="Active installations" value={app.activeInstallations} detail="Distinct anonymous installation IDs with an event" />
        <Metric label="Onboarding starts" value={app.onboardingStarts} detail="Distinct installation IDs; first-launch signal" />
        <Metric label="Onboarding completed" value={app.onboardingCompletions} detail="Distinct installation IDs; observed event" />
      </div><Bars title="Onboarding starts by day" points={app.dailyStarts} color="var(--app)" empty="No onboarding starts observed in this period." />
        <div className={styles.journey}><div className={styles.sectionTitle}><h3>Observed journey</h3><span>Distinct installations at each step · not an ordered funnel</span></div>
          {[["Onboarding started", app.onboardingStarts], ["Onboarding completed", app.onboardingCompletions], ["Test started", app.testStarts], ["Test completed", app.testCompletions], ["Paywall viewed", app.paywallViews], ["Purchase tapped", app.purchaseTaps], ["Client purchase complete", app.clientPurchases]].map(([label, value]) => <div className={styles.journeyRow} key={label}><span>{label}</span><i><b style={{ width: `${app.activeInstallations ? Number(value) / app.activeInstallations * 100 : 0}%` }} /></i><strong>{value}</strong></div>)}
        </div><div className={styles.twoBreakdowns}><div className={styles.breakdown}><div className={styles.sectionTitle}><h3>Tests</h3><span>Distinct installations</span></div>
          {app.testTypes.length ? app.testTypes.map((test) => <div className={styles.testRow} key={test.label}><span>{test.label}</span><span>{test.starts} started</span><strong>{test.completions} completed</strong></div>) : <p className={styles.empty}>No test events observed.</p>}</div>
          <Breakdown title="App-reported install source" rows={app.sources} empty="No source property observed." note="Not verified attribution" /></div>
      </> : <p className={styles.empty}>iOS app events could not be read. No zero or sample metrics are substituted.</p>}</section></div>

    <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>03 / Monetize</p><h3>Paywall context</h3></div><span>Observed client events, excluding preview and mock flags</span></div>
      {app.available ? <><div className={styles.metrics}>
        <Metric label="Paywall → buy tap" value={app.matchedPaywallViews ? `${Math.round(app.matchedPaywallTaps / app.matchedPaywallViews * 100)}%` : ""} unavailable={!app.matchedPaywallViews} detail={app.matchedPaywallViews ? `${app.matchedPaywallTaps} of ${app.matchedPaywallViews} observed paywall view IDs` : "Requires paywall view IDs and observed views"} />
        <Metric label="Client purchase completions" value={app.clientPurchases} detail="Distinct installation IDs; not verified transactions" />
        <Metric label="Verified proceeds" value="" unavailable detail="Requires official App Store sales reporting" />
      </div><div className={styles.twoBreakdowns}><Breakdown title="Paywall entry points" rows={app.paywallEntryPoints} empty="No real paywall events with entry points yet." note="Installations" />
        <Breakdown title="Purchase trigger tests" rows={app.purchaseTriggerTests} empty="No client purchase completions with a trigger test yet." note="Installations · client signal" /></div></> : <p className={styles.empty}>App event source unavailable; purchase metrics cannot be evaluated.</p>}</section>

    <section className={styles.attribution}><div><p className={styles.kicker}>04 / Connect the evidence</p><h3>Attribution status</h3><p>Website visit IDs expire with the browser session. App installation IDs are separate. Apple does not pass a shared ID from this website to the app, so Kopa cannot identify which website visit produced an install or purchase.</p></div>
      <div className={styles.attributionCards}><div><span>Website → app install</span><strong>Unavailable</strong><small>No shared identifier or verified campaign attribution</small></div><div><span>Verified paid purchases & revenue</span><strong>Unavailable</strong><small>Client purchase_completed is a signal, not an App Store transaction</small></div></div></section>

    <section className={styles.quality}><div className={styles.sectionTitle}><h3>Measurement notes</h3><span>Read directly from Supabase public.events · no fixtures</span></div>
      <ul><li>Website country is inferred from browser language, so it is not a reliable location or an attribution join key.</li>
        <li>Website “visits” are temporary tab/session IDs, not unique people. App “installations” are anonymous installation IDs, not App Store downloads. The first observed page is used for entry referrer and visit date; {web.available ? `${web.firstPagesWithoutIndex} visits lacked page_index` : "page-index coverage is unavailable"}.</li>
        <li>App events are production-tagged, but this early sample may include developer activity. New paywall context requires a shipped app build; {app.available ? `${app.paywallContextCount} paywall-view IDs were observed in this period` : "its coverage is unavailable"}.</li>
        <li>Exact repeated app rows excluded from activity counts: <strong>{app.available ? app.exactCopies : "unavailable"}</strong>. This is a provisional duplicate fingerprint because source event IDs are not stored.</li>
        <li>First observed: website {web.available ? utc(web.firstObserved) : "unavailable"}; app {app.available ? utc(app.firstObserved) : "unavailable"}. Empty days before these dates do not establish zero traffic.</li></ul></section>
  </div></PageShell>;
}
