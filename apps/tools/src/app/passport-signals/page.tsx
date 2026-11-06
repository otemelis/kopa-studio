import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";
import { passportEvents, summarizePassportCounts } from "@/lib/passport-signals/model";
import { passportWindow, readPassportCounts, readPassportWeb } from "@/lib/passport-signals/source";
import { readPassportWebEvents } from "@/lib/passport-signals/web-events";
import { summarizePassportWebEvents } from "@/lib/passport-signals/web-model";
import { getAsoProgressData } from "@/repositories/aso-progress-repository";
import { listApps } from "@/repositories/apps-repository";
import styles from "../lovetype-signals/signals.module.css";

export const dynamic = "force-dynamic";
type Channel = "appstore" | "testflight";
type Params = Promise<{ days?: string; channel?: string }>;
const fmt = (value: number) => new Intl.NumberFormat("en-US").format(value);
const time = (value: string | null) => value ? `${new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : "No upload observed";

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Bars({ title, points, color, dateNote }: { title: string; points: { date: string; value: number }[]; color: string; dateNote: string }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return <div className={styles.chart}><div className={styles.sectionTitle}><h3>{title}</h3><span>{dateNote}</span></div>
    {points.length ? <div className={styles.bars}>{points.map((point) => <div className={styles.barColumn} key={point.date} title={`${point.date}: ${point.value}`}>
      <b>{point.value}</b><div className={styles.barTrack}><i style={{ height: `${Math.max(8, point.value / max * 100)}%`, background: color }} /></div><time dateTime={point.date}>{point.date.slice(5)}</time>
    </div>)}</div> : <p className={styles.empty}>No reported observations in this window.</p>}</div>;
}

function Breakdown({ title, rows, metric }: { title: string; rows: { label: string; value: number }[]; metric: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className={styles.breakdown}><div className={styles.sectionTitle}><h3>{title}</h3><span>{metric}</span></div>
    {rows.length ? rows.map((row) => <div className={styles.breakRow} key={row.label}><span title={row.label}>{row.label}</span><i><b style={{ width: `${row.value / max * 100}%` }} /></i><strong>{row.value}</strong></div>)
      : <p className={styles.empty}>No breakdown reported.</p>}</div>;
}

export default async function PassportSignals({ searchParams }: { searchParams: Params }) {
  await requireUser();
  const params = await searchParams;
  const days: 7 | 28 = params.days === "28" ? 28 : 7;
  const channel: Channel = params.channel === "testflight" ? "testflight" : "appstore";
  const { start, end } = passportWindow(days);
  const app = (await listApps()).find((item) => item.storeAppId === "6822753543");
  const [countsResult, testflightResult, webResult, webEventsResult, asoResult] = await Promise.allSettled([
    readPassportCounts(days, channel),
    channel === "testflight" ? Promise.resolve(null) : readPassportCounts(days, "testflight"),
    readPassportWeb(days),
    readPassportWebEvents(days),
    app ? getAsoProgressData(app.id) : Promise.resolve(null),
  ]);
  const counts = countsResult.status === "fulfilled" ? countsResult.value.counts : null;
  const summary = counts ? summarizePassportCounts(counts) : null;
  const testflight = testflightResult.status === "fulfilled" && testflightResult.value
    ? summarizePassportCounts(testflightResult.value.counts) : null;
  const releaseTestRows = channel === "testflight" ? counts?.filter((row) => row.appVersion === "1.2")
    : testflightResult.status === "fulfilled" ? testflightResult.value?.counts.filter((row) => row.appVersion === "1.2") : null;
  const releaseTest = releaseTestRows ? summarizePassportCounts(releaseTestRows) : null;
  const web = webResult.status === "fulfilled" ? webResult.value : { available: false as const, reason: "Vercel Analytics could not be read." };
  const webEvents = webEventsResult.status === "fulfilled" ? webEventsResult.value
    : { available: false as const, reason: "Supabase passport-web could not be read." };
  const website = webEvents.available ? summarizePassportWebEvents(webEvents.events) : null;
  const aso = asoResult.status === "fulfilled" ? asoResult.value : null;
  const sales = aso?.sales.filter((row) => row.date >= start && row.date <= end && row.source === "appstore_connect_sales") ?? [];
  const asc = aso?.metrics.filter((row) => row.date >= start && row.date <= end && row.source === "appstore_connect_discovery") ?? [];
  const downloads = aso?.metrics.filter((row) => row.date >= start && row.date <= end && row.source === "appstore_connect_downloads" && row.event === "First-time download") ?? [];
  const paid = aso?.paidSearch.filter((row) => row.metric_date >= start && row.metric_date <= end) ?? [];
  const ascTotal = (name: string, pageType?: string) => {
    const rows = asc.filter((row) => row.event === name && (!pageType || row.page_type === pageType));
    return rows.length ? fmt(rows.reduce((sum, row) => sum + (row.count ?? 0), 0)) : "Unavailable";
  };
  const downloadTotal = downloads.length ? fmt(downloads.reduce((sum, row) => sum + (row.count ?? 0), 0)) : "Unavailable";
  const latestAppleDate = [...asc, ...downloads].map((row) => row.date).sort().at(-1);
  const appAvailable = counts !== null && counts.length > 0;
  const selectedQuery = (selectedDays: 7 | 28, selectedChannel: Channel) => `/passport-signals?days=${selectedDays}&channel=${selectedChannel}`;

  return <PageShell title="PASSPORT signals"><div className={styles.page}>
    <div className={styles.hero}><div><p className={styles.kicker}>PASSPORT · launch and version 1.2 watch</p><h2>Discovery, first stamps and return activity</h2>
      <p>Website, App Store and app actions come from separate providers. Compare their trends without treating them as one attributed customer journey.</p></div>
      <div className={styles.period} aria-label="Reporting window"><Link className={days === 7 ? styles.selected : ""} href={selectedQuery(7, channel)}>7 days</Link><Link className={days === 28 ? styles.selected : ""} href={selectedQuery(28, channel)}>28 days</Link></div></div>
    <div className={styles.sourceStrip}><div><span className={styles.sourceDot} data-available={web.available} /><b>Vercel website</b><span>{web.available ? `Queried ${time(web.queriedAt)}` : "Unavailable"}</span></div>
      <div><span className={styles.sourceDot} data-available={webEvents.available} /><b>Supabase website events</b><span>{website?.latestReceived ? `Last received ${time(website.latestReceived)}` : webEvents.available ? "No production events yet" : "Unavailable"}</span></div>
      <div><span className={styles.sourceDot} data-available={appAvailable} /><b>App aggregates</b><span>{summary ? `Last uploaded ${time(summary.latestUpload)}` : "Unavailable"}</span></div>
      <span>{start}–{end} · website UTC dates / app device-local days</span></div>
    <div className={styles.sourceStrip}><div><b>App build channel</b><Link href={selectedQuery(days, "appstore")}>{channel === "appstore" ? "● " : ""}App Store</Link><Link href={selectedQuery(days, "testflight")}>{channel === "testflight" ? "● " : ""}TestFlight</Link></div>
      <span>{channel === "appstore" ? "Customer-channel telemetry; developer activity may still be included." : "Internal testing only; not customer behavior."}</span></div>

    <div className={styles.columns}><section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>01 / Website</p><h3>Vercel Web Analytics</h3></div><span>meetpassport project · production traffic</span></div>
      {web.available ? <><div className={styles.metrics}><Metric label="Visitors" value={fmt(web.visitors)} detail="Vercel's deduplicated visitors for this period" />
        <Metric label="Page views" value={fmt(web.pageviews)} detail="Vercel production page views" />
        <Metric label="Website → app installs" value="Unavailable" detail="No shared visitor-to-install identifier" /></div>
        <Bars title="Daily page views" points={web.daily.map((row) => ({ date: row.label, value: row.pageviews }))} color="var(--web)" dateNote="UTC reporting day" />
        <div className={styles.twoBreakdowns}><Breakdown title="Pages" rows={web.paths.map((row) => ({ label: row.label, value: row.pageviews }))} metric="Page views" />
          <Breakdown title="Referrer hosts" rows={web.referrers.map((row) => ({ label: row.label, value: row.pageviews }))} metric="Page views" /></div>
      </> : <p className={styles.empty}>{web.reason} No zero or sample metrics are displayed.</p>}</section>

      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>02 / App</p><h3>{channel === "appstore" ? "App Store" : "TestFlight"} event activity</h3></div><span>Supabase passport_analytics.daily_counts</span></div>
        {appAvailable && summary ? <><div className={styles.metrics}><Metric label="App opens" value={fmt(summary.total("app_opened"))} detail="Event count, not unique installations" />
          <Metric label="First-stamp completions" value={fmt(summary.total("first_stamp_completed"))} detail="Recorded event count; cannot join to opens" />
          <Metric label="Stamps created" value={fmt(summary.total("stamp_created"))} detail="All stamp-created events" /></div>
          <Bars title="App opens by reported day" points={summary.byDay.map((row) => ({ date: row.day, value: row.opens }))} color="var(--app)" dateNote="Device-local calendar day" />
          <div className={styles.journey}><div className={styles.sectionTitle}><h3>Recorded actions</h3><span>Event totals · not an ordered funnel</span></div>
            {passportEvents.map(([event, label]) => <div className={styles.testRow} key={event}><span>{label}</span><strong>{fmt(summary.total(event))}</strong></div>)}</div>
          <div className={styles.breakdown}><div className={styles.sectionTitle}><h3>App versions</h3><span>Selected channel</span></div>
            {summary.byVersion.map((version) => <div className={styles.testRow} key={version.version}><span>v{version.version}</span><span>{version.opens} opens · {version.firstStamps} first stamps</span><strong>{version.events} events</strong></div>)}</div>
        </> : <p className={styles.empty}>{counts === null ? "Read-only PASSPORT source could not be queried." : "No events have been uploaded for this channel and selected days."} No zero or sample activity is substituted.</p>}</section></div>

    <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>Website interactions</p><h3>PASSPORT web activity</h3></div><span>Supabase public.events · app_id passport-web · production only</span></div>
      {webEvents.available && website && webEvents.events.length ? <><p>Temporary visit IDs identify visits within a browser session, not people or app installations. Last event received {time(website.latestReceived)}.</p>
        <div className={styles.metrics}><Metric label="Observed visits" value={fmt(website.visits)} detail="Distinct temporary IDs with a page view" />
          <Metric label="Page views" value={fmt(website.pageViews)} detail="Recorded page_view events" />
          <Metric label="App Store tap visits" value={fmt(website.appStoreTapVisits)} detail={`${fmt(website.appStoreTaps)} tap events; not verified downloads`} />
          <Metric label="CTA clicks" value={fmt(website.ctaClicks)} detail="Recorded website CTA events" /></div>
        <Bars title="Website page views" points={website.daily.map((row) => ({ date: row.date, value: row.views }))} color="var(--web)" dateNote="UTC client event day" />
        <div className={styles.twoBreakdowns}><Breakdown title="Pages" rows={website.paths} metric="Page-view events" />
          <Breakdown title="Entry referrers" rows={website.referrers} metric="First page per observed visit" /></div>
        <div className={styles.journey}><div className={styles.sectionTitle}><h3>Website actions</h3><span>Event totals · not an app conversion funnel</span></div>
          {[["Tool starts", website.toolStarts], ["Sent to app", website.toolSentToApp], ["Import links opened", website.importLinksOpened], ["Print previews", website.printsPreviews]].map(([label, value]) =>
            <div className={styles.testRow} key={label}><span>{label}</span><strong>{fmt(value as number)}</strong></div>)}</div>
      </> : <p className={styles.empty}>{webEvents.available
        ? `No production passport-web events observed in this ${days}-day window.${webEvents.developmentRows ? ` ${fmt(webEvents.developmentRows)} development events were excluded.` : ""}`
        : webEvents.reason} No zero or sample customer metrics are substituted.</p>}</section>

    <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>03 / Acquisition</p><h3>Official App Store reporting</h3></div><span><Link href="/app-store-connect">Source status</Link></span></div>
      <p>Apple Analytics report dates {start}–{end} UTC · all reported territories · latest available date {latestAppleDate ?? "Unavailable"}. Apple reports may lag or be thresholded; missing dates are unavailable, not zero.</p>
      <div className={styles.metrics}><Metric label="Impressions" value={ascTotal("Impression")} detail="App Store Connect Discovery; reported events across all territories" />
        <Metric label="Product-page views" value={ascTotal("Page view", "Product page")} detail="App Store Connect Discovery; excludes developer-page views" />
        <Metric label="First-time downloads" value={downloadTotal} detail="App Store Connect Downloads; not Sales units or unique people" />
        <Metric label="Sales report units" value={sales.length ? fmt(sales.reduce((sum, row) => sum + (row.downloads ?? 0), 0)) : "Unavailable"} detail="Official Sales and Trends units; not first-time downloads" /></div>
      {downloads.length ? <Breakdown title="First-time downloads by Apple source" rows={Object.entries(downloads.reduce<Record<string, number>>((totals, row) => { const source = row.source_type ?? "Unspecified"; totals[source] = (totals[source] ?? 0) + (row.count ?? 0); return totals; }, {})).map(([label, value]) => ({ label, value }))} metric="Apple source type · not user attribution" /> : null}
      <div className={styles.metrics}><Metric label="Apple Ads impressions" value={paid.length ? fmt(paid.reduce((sum, row) => sum + (row.impressions ?? 0), 0)) : "Unavailable"} detail="Only PASSPORT-mapped campaign rows" />
        <Metric label="Verified paid purchases" value="Unavailable" detail="App event counts are not App Store transactions" />
        <Metric label="Website CTA actions" value={website?.latestReceived ? fmt(website.ctaClicks) : "Unavailable"} detail="Supabase passport-web events; not attributed downloads" /></div></section>

    <section className={styles.attribution}><div><p className={styles.kicker}>04 / Version 1.2 readiness</p><h3>Keep the release baseline honest</h3>
      <p>{channel === "appstore" ? `Production versions observed: ${summary?.versions.join(", ") || "none"}. ` : ""}{testflight?.versions.includes("1.2") || channel === "testflight" && summary?.versions.includes("1.2")
        ? "Version 1.2 has TestFlight event coverage. These events validate instrumentation, not production adoption."
        : "No version 1.2 TestFlight events were readable in this window."} Compare production version 1.2 only after that build is released and its own events arrive.</p></div>
      <div className={styles.attributionCards}><div><span>Website to installation</span><strong>Unavailable</strong><small>No verified cross-source identity or attribution</small></div>
        <div><span>App users / retention</span><strong>Unavailable</strong><small>PASSPORT stores aggregate counts, not installation IDs</small></div></div></section>
    {releaseTestRows?.length ? <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>TestFlight only</p><h3>Version 1.2 instrumentation check</h3></div><span>Not customer adoption</span></div>
      <div className={styles.metrics}><Metric label="App opens" value={fmt(releaseTest?.total("app_opened") ?? 0)} detail="TestFlight 1.2 event count" />
        <Metric label="First stamps" value={fmt(releaseTest?.total("first_stamp_completed") ?? 0)} detail="TestFlight 1.2 event count" />
        <Metric label="Flights logged" value={fmt(releaseTest?.total("flight_logged") ?? 0)} detail="TestFlight 1.2 event count" /></div></section> : null}
    <section className={styles.quality}><div className={styles.sectionTitle}><h3>Measurement notes</h3><span>No fixtures or synthetic fallbacks</span></div><ul>
      <li>PASSPORT app days are device-local; Supabase website events use client UTC timestamps, while Vercel and Apple report their own dates. Daily values must not be joined as if they shared a timezone.</li>
      <li>App action totals are anonymous aggregate event counts. They do not support unique users, conversion rates, ordered funnels, or retention.</li>
      <li>Website visitors and page views come from Vercel Web Analytics for the meetpassport project. Referrer hosts are not verified install sources; direct or missing referrers are grouped as unknown.</li>
      <li>Supabase passport-web events are a separate cookieless website source. Only production events appear as customer activity; development events are excluded. Temporary visit IDs do not identify people across visits or link to the app.</li>
      <li>Apple Sales units, App Store Connect impressions, Apple Ads delivery, app actions and client purchase signals have separate definitions. Unavailable means no validated source row or failed access, never zero activity.</li>
    </ul></section>
  </div></PageShell>;
}
