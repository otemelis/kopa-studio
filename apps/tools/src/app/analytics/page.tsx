import { PageShell } from "@/components/page-shell";
import { loadProductEvents, type ProductEvent } from "@/repositories/product-analytics-repository";

export const dynamic = "force-dynamic";
type Search = Promise<{ app?: string; period?: string }>;
type Row = { label: string; value: number; note?: string };
const periods = new Set(["7d", "28d", "90d"]);
const number = new Intl.NumberFormat("en-US");
const label = (value: string) => value.split("_").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");
const percent = (value: number, total: number) => total ? `${Math.round(value / total * 100)}%` : "—";
const count = (events: ProductEvent[], names: string | string[]) => events.filter((event) => (Array.isArray(names) ? names : [names]).includes(event.eventName)).length;
const unique = (events: ProductEvent[], key: "anonymousId" | "sessionId") => new Set(events.map((event) => event[key]).filter(Boolean)).size;
const property = (event: ProductEvent, name: string) => typeof event.properties[name] === "string" ? event.properties[name] as string : "";
const numericProperty = (event: ProductEvent, name: string) => Number(event.properties[name]) || 0;

function dateKey(value: string) { return new Date(value).toISOString().slice(0, 10); }
function groupedUsers(events: ProductEvent[], getKey: (event: ProductEvent) => string) {
  const groups = new Map<string, Set<string>>();
  for (const event of events) {
    const identity = event.anonymousId ?? event.sessionId;
    if (!identity) continue;
    const name = getKey(event) || "Unknown";
    const group = groups.get(name) ?? new Set<string>(); group.add(identity); groups.set(name, group);
  }
  return [...groups.entries()].map(([name, people]) => ({ name, value: people.size })).sort((a, b) => b.value - a.value);
}
function Funnel({ title, note, rows }: { title: string; note: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className="analytics-panel funnel-panel"><header><div><h2>{title}</h2><p>{note}</p></div></header><div className="funnel-list">{rows.map((row, index) => <div className="funnel-row" key={row.label}><div className="funnel-step"><span>{index + 1}</span><div><strong>{row.label}</strong><small>{row.note ?? "Event count"}</small></div></div><div className="funnel-track"><i style={{ width: `${Math.max(row.value ? 3 : 0, row.value / max * 100)}%` }} /></div><b>{number.format(row.value)}</b></div>)}</div></section>;
}
function Segment({ title, note, rows }: { title: string; note: string; rows: Array<{ name: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className="analytics-panel segment-panel"><header><div><h2>{title}</h2><p>{note}</p></div></header>{rows.length ? <div className="segment-list">{rows.slice(0, 6).map((row) => <div key={row.name}><span>{row.name}</span><i><b style={{ width: `${row.value / max * 100}%` }} /></i><strong>{number.format(row.value)}</strong></div>)}</div> : <p className="empty-copy">No identifying properties recorded in this period.</p>}</section>;
}
function Coverage({ names, catalog, events }: { names: string[]; catalog: Set<string>; events: ProductEvent[] }) {
  return <section className="analytics-panel coverage-panel"><header><div><h2>Instrumentation coverage</h2><p>Expected events stay visible before traffic arrives.</p></div><span>{names.filter((name) => catalog.has(name)).length}/{names.length} catalogued</span></header><div className="coverage-list">{names.map((name) => <div key={name}><span className={catalog.has(name) ? "coverage-ok" : "coverage-pending"}>{catalog.has(name) ? "Ready" : "Not catalogued"}</span><strong>{label(name)}</strong><b>{number.format(count(events, name))}</b></div>)}</div></section>;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const period = periods.has(params.period ?? "") ? params.period! : "28d";
  const days = Number.parseInt(period, 10);
  const { events: rawEvents, apps, catalog } = await loadProductEvents(days, params.app);
  const events = rawEvents.filter((event) => event.environment !== "dev");
  const devEvents = rawEvents.length - events.length;
  const eventNames = new Set(catalog.map((entry) => entry.eventName));
  const people = unique(events, "anonymousId");
  const sessions = unique(events, "sessionId");
  const starts = count(events, ["assessment_started", "test_started", "game_started", "level_started", "draft_started"]);
  const completions = count(events, ["assessment_completed", "test_completed", "game_completed", "level_completed", "draft_completed"]);
  const paywalls = count(events, ["paywall_viewed", "unlock_screen_viewed"]);
  const purchases = count(events, "purchase_success");
  const adRevenue = events.filter((event) => event.eventName === "ad_revenue_paid").reduce((sum, event) => sum + numericProperty(event, "revenue"), 0);
  const adImpressions = count(events, "ad_impression");
  const ratingShown = count(events, "rating_prompt_shown");
  const ratingRequested = count(events, "app_store_review_requested");
  const daily = Array.from({ length: days }, (_, index) => { const date = new Date(Date.now() - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10); const dayEvents = events.filter((event) => dateKey(event.occurredAt) === date); return { date, users: unique(dayEvents, "anonymousId"), events: dayEvents.length }; });
  const maxDaily = Math.max(1, ...daily.map((day) => day.users));
  const topEvents = [...new Set([...catalog.map((entry) => entry.eventName), ...events.map((event) => event.eventName)])].map((eventName) => ({ name: label(eventName), value: count(events, eventName) })).sort((a, b) => b.value - a.value);
  const coreRows: Row[] = [{ label: "First open", value: count(events, "app_first_open"), note: "New installs" }, { label: "Sessions started", value: count(events, ["session_start", "app_opened"]) }, { label: "Core flow started", value: starts }, { label: "Core flow completed", value: completions, note: `${percent(completions, starts)} completion` }, { label: "Result viewed", value: count(events, "result_viewed") }];
  const purchaseRows: Row[] = [{ label: "Paywall viewed", value: paywalls }, { label: "Price rendered", value: count(events, "price_seen") }, { label: "Purchase tapped", value: count(events, ["purchase_tapped", "unlock_tapped"]) }, { label: "Purchase success", value: purchases, note: `${percent(purchases, paywalls)} of paywall views` }, { label: "Purchase failed", value: count(events, "purchase_failed"), note: "Excludes user cancellations" }];
  const adRows: Row[] = [{ label: "Rewarded requested", value: count(events, "ad_rewarded_requested") }, { label: "Rewarded started", value: count(events, "ad_rewarded_started"), note: "Intent to show" }, { label: "Rewarded completed", value: count(events, "ad_rewarded_completed"), note: `${percent(count(events, "ad_rewarded_completed"), count(events, "ad_rewarded_started"))} completion` }, { label: "Rewarded failed", value: count(events, "ad_rewarded_failed") }, { label: "Paid impressions", value: adImpressions, note: `$${adRevenue.toFixed(2)} reported revenue` }];
  const ratingRows: Row[] = [{ label: "Prompt shown", value: ratingShown }, { label: "Prompt dismissed", value: count(events, "rating_prompt_dismissed") }, { label: "Positive tap", value: count(events, "rating_prompt_positive_tap") }, { label: "Store review requested", value: ratingRequested, note: `${percent(ratingRequested, ratingShown)} of prompts` }];
  const lifecycleRows: Row[] = [{ label: "First opens", value: count(events, "app_first_open") }, { label: "Session starts", value: count(events, "session_start") }, { label: "Session ends", value: count(events, "session_end") }, { label: "Explicit exits", value: count(events, "assessment_exited") }, { label: "Abandonments", value: count(events, "assessment_abandoned"), note: "Idle-flow signal" }];
  const monitored = ["app_first_open", "session_start", "session_end", "paywall_viewed", "purchase_success", "purchase_failed", "ad_placement_available", "ad_placement_unavailable", "ad_rewarded_requested", "ad_rewarded_completed", "ad_rewarded_failed", "ad_impression", "ad_revenue_paid", "rating_prompt_shown", "rating_prompt_positive_tap", "app_store_review_requested"];
  const insights = [starts > 0 && completions / starts < .6 ? { title: "Journey drop-off needs attention", text: `Only ${percent(completions, starts)} of core starts complete. Examine the earliest screen or decision before adding acquisition spend.` } : null, paywalls > 0 && purchases / paywalls < .08 ? { title: "Monetization conversion is low", text: `${number.format(paywalls)} offer views resulted in ${percent(purchases, paywalls)} completed purchases. Compare price rendering and failure events by version.` } : null, count(events, "ad_rewarded_requested") > 0 && count(events, "ad_rewarded_completed") / count(events, "ad_rewarded_requested") < .6 ? { title: "Rewarded-ad delivery is leaking", text: `Only ${percent(count(events, "ad_rewarded_completed"), count(events, "ad_rewarded_requested"))} of rewarded requests result in a completed reward. Check availability, starts, and failure codes by placement.` } : null, devEvents > 0 ? { title: "Development traffic is excluded", text: `${number.format(devEvents)} dev event${devEvents === 1 ? "" : "s"} are hidden from decision metrics.` } : null].filter(Boolean) as Array<{ title: string; text: string }>;
  return <PageShell title="Product analytics"><div className="analytics-toolbar"><div><p className="eyebrow">Portfolio intelligence</p><h2>Every important product signal, in one place.</h2><p>Production events only · {number.format(events.length)} events in the selected window</p></div><form><input type="hidden" name="period" value={period} /><label>Product<select name="app" defaultValue={params.app ?? ""}><option value="">All products</option>{apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</select></label><button type="submit">Apply</button></form></div><section className="metric-grid analytics-metrics"><article className="metric-card"><p>Active people</p><strong>{number.format(people)}</strong><small>Unique anonymous installs</small></article><article className="metric-card"><p>Sessions</p><strong>{number.format(sessions)}</strong><small>{people ? `${(sessions / people).toFixed(1)} per active person` : "Awaiting traffic"}</small></article><article className="metric-card"><p>Ad revenue</p><strong>${adRevenue.toFixed(2)}</strong><small>{number.format(adImpressions)} paid impressions</small></article><article className="metric-card"><p>Review intent</p><strong>{number.format(ratingRequested)}</strong><small>{percent(ratingRequested, ratingShown)} of rating prompts</small></article></section><section className="analytics-panel activity-panel"><header><div><h2>Daily active people</h2><p>Unique anonymous installs · {days}-day window</p></div><span>Peak {number.format(maxDaily)}</span></header><div className="activity-chart">{daily.map((day) => <div key={day.date} title={`${day.date}: ${day.users} people · ${day.events} events`}><i style={{ height: `${Math.max(day.users ? 4 : 0, day.users / maxDaily * 100)}%` }} /></div>)}</div><footer><span>{daily[0]?.date}</span><span>{daily[daily.length - 1]?.date}</span></footer></section><div className="analytics-two-col"><Funnel title="Lifecycle & core journey" note="Installs through product completion" rows={coreRows} /><Funnel title="Purchase health" note="Offer exposure through payment outcome" rows={purchaseRows} /></div><div className="section-head"><h2>Monetisation & reputation</h2><span>Dedicated performance dashboards for every event state</span></div><div className="analytics-two-col"><Funnel title="Rewarded ads & yield" note="Intent, delivery, reward, and paid impression signals" rows={adRows} /><Funnel title="Rating & App Store review" note="Prompt behaviour through native review request" rows={ratingRows} /></div><div className="analytics-two-col"><Funnel title="Lifecycle & retention signals" note="Sessions, exits, and abandonment instrumentation" rows={lifecycleRows} /><Coverage names={monitored} catalog={eventNames} events={events} /></div><div className="section-head"><h2>Decision brief</h2><span>Signals derived from the selected window</span></div><div className="decision-grid">{insights.length ? insights.map((insight) => <article key={insight.title}><span>Signal</span><h3>{insight.title}</h3><p>{insight.text}</p></article>) : <article><span>Signal</span><h3>Waiting for enough production signal</h3><p>Every dashboard above is live and ready; recommendations become specific as events arrive.</p></article>}</div><div className="analytics-two-col"><Segment title="Acquisition source" note="Unique people from event properties" rows={groupedUsers(events, (event) => property(event, "source"))} /><Segment title="Top event activity" note="All catalogued and observed event types" rows={topEvents} /></div><div className="analytics-two-col"><Segment title="Countries" note="Server-derived country where available" rows={groupedUsers(events, (event) => event.country ?? "")} /><Segment title="Platform & version" note="Unique people by client metadata" rows={groupedUsers(events, (event) => [event.platform, event.appVersion].filter(Boolean).join(" / "))} /></div></PageShell>;
}
