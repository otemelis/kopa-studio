"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  day,
  offsetDay,
  type ProductScope,
} from "@/lib/product-analytics/contracts";
import type {
  JourneyNode,
  ProductReport,
} from "@/lib/product-analytics/engine";
const number = (v: number) => v.toLocaleString("en-GB");
const percent = (v: number | null) =>
  v === null ? "Unavailable" : (v * 100).toFixed(1) + "%";
const title = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const stamp = (s: string | null) =>
  s ? s.replace("T", " ").slice(0, 19) + " UTC" : "Unavailable";
const TABS = {
  journeys: "Journeys",
  funnels: "Funnels",
  retention: "Retention & cohorts",
  events: "Event Explorer",
  quality: "Data quality",
};
type ResponseState = { key: string; report?: ProductReport; error?: string };
function Panel({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="sig-panel">
      <div className="sig-panel-head">
        <div>
          <h2>{title}</h2>
          {detail && <p>{detail}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Timeline({
  data,
  metric,
}: {
  data: ProductReport;
  metric: "sessions" | "events";
}) {
  return (
    <div
      className="real-chart"
      role="img"
      aria-label={`Daily observed ${metric}, with previous equal-length period. Missing dates are gaps, not verified zeros.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data.trend}
          margin={{ top: 12, right: 20, left: -12, bottom: 6 }}
        >
          <CartesianGrid
            stroke="var(--sig-line)"
            vertical={false}
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => String(v).slice(5)}
            tick={{ fill: "var(--sig-muted)", fontSize: 10 }}
            minTickGap={35}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--sig-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as
                ProductReport["trend"][number] | undefined;
              return active && row ? (
                <div className="real-tooltip">
                  <b>{row.date} · UTC</b>
                  <p>
                    {row[metric] ?? "No records / coverage unknown"} recorded{" "}
                    {metric}
                  </p>
                  <p>
                    {row.priorDate}:{" "}
                    {row[
                      metric === "sessions"
                        ? "previousSessions"
                        : "previousEvents"
                    ] ?? "Coverage unknown"}
                  </p>
                </div>
              ) : null;
            }}
          />
          <Area
            type="linear"
            dataKey={metric}
            name={`Recorded ${metric}`}
            stroke="var(--series-1)"
            fill="var(--series-1)"
            fillOpacity={0.1}
            strokeWidth={2}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey={
              metric === "sessions" ? "previousSessions" : "previousEvents"
            }
            name="Previous period"
            stroke="var(--series-2)"
            strokeDasharray="5 4"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
function JourneyBranches({
  node,
  selected,
  onSelect,
}: {
  node: JourneyNode;
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <div className="real-branches">
      {node.children.map((n) => (
        <button
          key={n.key}
          aria-pressed={onSelect ? n.key === selected : undefined}
          disabled={!onSelect}
          onClick={() => onSelect?.(n.key)}
          className={
            /No next|Observation|Ambiguous|Missing/.test(n.name)
              ? "real-drop"
              : ""
          }
        >
          <span>
            {title(n.name)}
            <small>
              {number(n.sessions)} {n.sessions === 1 ? "session" : "sessions"} ·{" "}
              {percent(node.sessions ? n.sessions / node.sessions : null)} of
              this step
            </small>
          </span>
          <i
            style={{
              width:
                (node.sessions ? (100 * n.sessions) / node.sessions : 0) + "%",
            }}
          />
        </button>
      ))}
    </div>
  );
}
function Journey({ root }: { root: JourneyNode }) {
  const [selected, setSelected] = useState<string>();
  const branch =
    root.children.find((n) => n.key === selected) || root.children[0];

  return (
    <div className="real-journey">
      <div className="real-root">
        <span className="sig-eyebrow">FIRST SELECTED ENTRY</span>
        <h3>{title(root.name)}</h3>
        <strong>{number(root.sessions)}</strong>
        <p>recorded sessions</p>
      </div>
      <div>
        <h3>Next meaningful step</h3>
        <JourneyBranches
          node={root}
          selected={branch?.key}
          onSelect={setSelected}
        />
      </div>
      <div>
        <h3>
          {branch ? "After " + title(branch.name).toLowerCase() : "Next step"}
        </h3>
        {branch?.children.length ? (
          <JourneyBranches node={branch} />
        ) : (
          <p className="real-note">
            The path ends at this observation boundary.
          </p>
        )}
      </div>
    </div>
  );
}
export function RealProductWorkspace() {
  const router = useRouter(),
    search = useSearchParams(),
    query = search.toString();
  const [result, setResult] = useState<ResponseState>({ key: "initial" }),
    [reload, setReload] = useState(0),
    [metric, setMetric] = useState<"sessions" | "events">("sessions"),
    [command, setCommand] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController(),
      key = query + ":" + reload;
    fetch("/api/signal/product?" + query, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.report)
          throw new Error(body.error || "Source unavailable.");
        if (!controller.signal.aborted) setResult({ key, report: body.report });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, error: error.message });
      });
    return () => controller.abort();
  }, [query, reload]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setCommand((v) => !v);
      }
      if (event.key === "Escape") setCommand(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (command) {
      dialog.current?.showModal();
      close.current?.focus();
    }
  }, [command]);
  const loading = result.key !== query + ":" + reload;
  const data = loading ? undefined : result.report;
  const scope = data?.scope;
  const patch = (change: Record<string, string>) => {
    const p = new URLSearchParams(query);
    for (const [key, value] of Object.entries(change)) p.set(key, value);
    router.push("/analytics?" + p.toString(), { scroll: false });
  };
  const select = (
    label: string,
    key: string,
    values: string[],
    allLabel = "All",
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={scope?.[key as keyof ProductScope] || "ALL"}
        onChange={(e) => patch({ [key]: e.target.value })}
      >
        <option value="ALL">{allLabel}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
  const exportData = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `InnerType-OBSERVED-${data.scope.start}-${data.scope.end}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="signal-app real-product">
      <div className="sig-review">
        <strong>ACTUAL TELEMETRY · READ-ONLY SNAPSHOT</strong>
        <span>Local development · no production operations</span>
        <ThemeToggle ownerId="local-real-data" />
      </div>
      <div className="sig-shell">
        <aside className="sig-sidebar">
          <Link href="/analytics?app=innertype" className="sig-wordmark">
            KOPA<small>STUDIO / SIGNAL</small>
          </Link>
          <nav aria-label="Main navigation">
            {[
              ["◫", "Overview", "/"],
              ["⌁", "Keywords", "/keywords"],
              ["↗", "Apple Ads", "/apple-ads-lab/reporting"],
              ["⌘", "Product Analytics", "/analytics?app=innertype"],
              ["⊕", "Experiments", "/experiments"],
              ["▤", "Sources", "/app-store-connect"],
            ].map(([icon, name, href]) => (
              <Link
                key={name}
                aria-label={name}
                href={href}
                aria-current={name === "Product Analytics" ? "page" : undefined}
              >
                <span aria-hidden>{icon}</span>
                <b>{name}</b>
              </Link>
            ))}
          </nav>
          <div className="sig-side-footer">
            <span className="sig-avatar">K</span>
            <span>
              Kopa workspace<small>Isolated development data</small>
            </span>
          </div>
        </aside>
        <div className="sig-workspace">
          <header className="sig-top">
            <span>Workspace / Product Analytics / InnerType</span>
            <button onClick={() => setCommand(true)}>
              Jump to an analysis <kbd>⌘ K</kbd>
            </button>
          </header>
          <main className="sig-main">
            <div className="sig-title">
              <div>
                <span className="sig-eyebrow">
                  INNERTYPE · PRODUCT ANALYTICS
                </span>
                <h1>Understand the observed journey.</h1>
                <p>
                  Actual events, explicit definitions, and a clear view of what
                  the data can tell us.
                </p>
              </div>
              <div className="sig-actions">
                <button disabled={!data} onClick={exportData}>
                  Export evidence ↓
                </button>
                <button onClick={() => setReload((n) => n + 1)}>
                  Re-read snapshot
                </button>
              </div>
            </div>
            {loading ? (
              <section className="real-state" role="status">
                <h2>Reading the validated source…</h2>
                <p>Previous metrics are hidden while this scope loads.</p>
              </section>
            ) : !data || !scope ? (
              <section className="real-state" role="alert">
                <span className="sig-eyebrow">SOURCE UNAVAILABLE</span>
                <h2>No metrics have been substituted.</h2>
                <p>{result.error}</p>
                <button onClick={() => router.push("/analytics?app=innertype")}>
                  Reset to InnerType source
                </button>
              </section>
            ) : (
              <>
                <div className="real-filters">
                  <label>
                    Application
                    <select
                      aria-label="Application"
                      value={scope.app}
                      onChange={(e) => patch({ app: e.target.value })}
                    >
                      <option value="innertype">InnerType</option>
                      <option value="pois">POIS · source not validated</option>
                      <option value="lovetype">
                        LoveType · source not validated
                      </option>
                    </select>
                  </label>
                  <form
                    key={scope.start + scope.end}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      patch({
                        start: String(form.get("start")),
                        end: String(form.get("end")),
                      });
                    }}
                  >
                    <label>
                      From · UTC
                      <input
                        aria-label="Start date"
                        name="start"
                        type="date"
                        defaultValue={scope.start}
                        required
                      />
                    </label>
                    <label>
                      Through · UTC
                      <input
                        aria-label="End date"
                        name="end"
                        type="date"
                        defaultValue={scope.end}
                        max={day(data.source.asOf)}
                        required
                      />
                    </label>
                    <button type="submit">Apply dates</button>
                  </form>
                  <div className="sig-periods">
                    {[7, 28, 90].map((days) => (
                      <button
                        key={days}
                        onClick={() => {
                          const end = offsetDay(day(data.source.asOf), -1);
                          patch({ start: offsetDay(end, -(days - 1)), end });
                        }}
                      >
                        {days}D
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        patch({
                          start: day(
                            data.quality.firstEvent || data.source.asOf,
                          ),
                          end: offsetDay(day(data.source.asOf), -1),
                        })
                      }
                    >
                      All observed
                    </button>
                  </div>
                </div>
                <div className="real-filters real-secondary">
                  {select("Captured region", "country", data.filters.countries)}
                  {select("App version", "version", data.filters.versions)}
                  {select("Language", "language", data.filters.languages)}
                  {select("Client source tag", "source", data.filters.sources)}
                  {select(
                    "Assessment type",
                    "assessment",
                    data.filters.assessments,
                  )}
                  <label>
                    Analysis unit
                    <select
                      aria-label="Analysis unit"
                      value="session"
                      onChange={() => {}}
                    >
                      <option value="session">Recorded session</option>
                      <option disabled>
                        Unique user · identity unavailable
                      </option>
                      <option disabled>
                        Installation · continuity unverified
                      </option>
                    </select>
                  </label>
                  <button
                    onClick={() =>
                      patch({
                        country: "ALL",
                        version: "ALL",
                        language: "ALL",
                        source: "ALL",
                        assessment: "ALL",
                      })
                    }
                  >
                    Clear segments
                  </button>
                </div>
                <div className="sig-reliability">
                  <span>Source snapshot: {stamp(data.source.asOf)}</span>
                  <span>
                    Last event received: {stamp(data.quality.lastReceived)}
                  </span>
                  <span>
                    Compared with {data.comparison.start} –{" "}
                    {data.comparison.end} UTC
                  </span>
                </div>
                <div className="real-warning">
                  <span aria-hidden>◈</span>
                  <div>
                    <strong>Identity continuity needs repair</strong>
                    <p>
                      {number(data.quality.fragmentedSessions)} of{" "}
                      {number(data.quality.sessions)} recorded sessions contain
                      multiple anonymous IDs. These are session observations,
                      not unique-user metrics.{" "}
                      <button
                        className="sig-link"
                        onClick={() => patch({ tab: "quality" })}
                      >
                        Inspect the evidence →
                      </button>
                    </p>
                  </div>
                </div>
                <div className="sig-stats">
                  <Stat
                    label="Recorded sessions"
                    value={number(data.metrics.sessions)}
                    note={`${number(data.previous.sessions)} in previous period · not users`}
                  />
                  <Stat
                    label="Captured event rows"
                    value={number(data.metrics.events)}
                    note={`${number(data.previous.events)} previous · possible retries retained`}
                  />
                  <Stat
                    label="Observed activity days"
                    value={number(data.metrics.observedDays)}
                    note="Missing dates have unverified coverage"
                  />
                  <Stat
                    label="User retention"
                    value="Unavailable"
                    note="Identity and first-open quality gate"
                  />
                </div>
                <nav className="real-tabs" aria-label="Product analysis">
                  {Object.entries(TABS).map(([key, label]) => (
                    <button
                      key={key}
                      aria-current={scope.tab === key ? "page" : undefined}
                      onClick={() => patch({ tab: key })}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                {data.metrics.events === 0 && (
                  <section className="real-state">
                    <h2>No events recorded for this scope.</h2>
                    <p>
                      This is an empty observation, not evidence of zero real
                      activity. Try a wider date range or clear the segments.
                    </p>
                  </section>
                )}
                {(scope.tab === "journeys" || scope.tab === "funnels") && (
                  <>
                    <Panel
                      title="Observed activity over time"
                      detail="Solid: selected dates · dashed: previous equal-length period · gaps: no records, coverage unknown"
                    >
                      <div className="real-inline">
                        <button
                          aria-pressed={metric === "sessions"}
                          onClick={() => setMetric("sessions")}
                        >
                          Sessions
                        </button>
                        <button
                          aria-pressed={metric === "events"}
                          onClick={() => setMetric("events")}
                        >
                          Event rows
                        </button>
                      </div>
                      <Timeline data={data} metric={metric} />
                      <details className="real-daily">
                        <summary>
                          View daily observations and comparison dates
                        </summary>
                        <div className="real-table">
                          <table>
                            <thead>
                              <tr>
                                <th>Date · UTC</th>
                                <th>Event rows</th>
                                <th>Recorded sessions</th>
                                <th>Comparison date</th>
                                <th>Previous rows</th>
                                <th>Previous sessions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.trend.map((point) => (
                                <tr key={point.date}>
                                  <td>{point.date}</td>
                                  <td>
                                    {point.events ?? "Gap / unknown coverage"}
                                  </td>
                                  <td>{point.sessions ?? "—"}</td>
                                  <td>{point.priorDate}</td>
                                  <td>
                                    {point.previousEvents ??
                                      "Gap / unknown coverage"}
                                  </td>
                                  <td>{point.previousSessions ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <p className="real-note">
                        Counts are provisional. Historical delivery lag reaches{" "}
                        {(data.quality.lagMaxSeconds! / 86400).toFixed(1)} days;
                        this snapshot has no completeness heartbeat.
                      </p>
                    </Panel>
                    {scope.tab === "journeys" ? (
                      <Panel
                        title="Where the observed journey goes next"
                        detail="First selected entry per recorded session · next meaningful steps · 24-hour observation window"
                      >
                        <div className="real-inline">
                          <label>
                            Start from{" "}
                            <select
                              aria-label="Journey start"
                              value={scope.journey}
                              onChange={(e) =>
                                patch({ journey: e.target.value })
                              }
                            >
                              <option value="assessment_started">
                                Assessment started
                              </option>
                              <option value="app_opened">App opened</option>
                              <option value="paywall_viewed">
                                Paywall viewed
                              </option>
                            </select>
                          </label>
                          <span>
                            Choose a branch to inspect the following step.
                          </span>
                        </div>
                        {data.journey.sessions ? (
                          <Journey key={query} root={data.journey} />
                        ) : (
                          <p className="real-note">
                            No selected journey entries were recorded.
                          </p>
                        )}
                        <p className="real-note">
                          “No next recorded step” is an observation boundary,
                          not proven abandonment or churn. Equal-time
                          transitions are marked ambiguous. Repeated questions
                          and duplicate aliases are excluded.
                        </p>
                      </Panel>
                    ) : (
                      <Panel
                        title={
                          scope.funnel === "assessment"
                            ? "Assessment conversion, by recorded session"
                            : "Client purchase signals, by recorded session"
                        }
                        detail="Closed ordered funnel · 24 hours from an entry · one count per recorded session at each step"
                      >
                        <div className="real-inline">
                          <label>
                            Funnel{" "}
                            <select
                              aria-label="Funnel"
                              value={scope.funnel}
                              onChange={(e) =>
                                patch({ funnel: e.target.value })
                              }
                            >
                              <option value="assessment">
                                Assessment → result
                              </option>
                              <option value="purchase">
                                Paywall → client purchase signal
                              </option>
                            </select>
                          </label>
                          <span>
                            Overall conversion:{" "}
                            <strong>
                              {percent(data.funnel.steps.at(-1)!.conversion)}
                            </strong>
                          </span>
                        </div>
                        <div className="real-funnel">
                          {data.funnel.steps.map((step, i) => (
                            <div className="real-funnel-row" key={step.name}>
                              <span className="sig-step-index">{i + 1}</span>
                              <div>
                                <strong>{title(step.name)}</strong>
                                <small>
                                  {number(
                                    data.previousFunnel.steps[i].sessions,
                                  )}{" "}
                                  previous period
                                </small>
                              </div>
                              <div className="real-funnel-track">
                                <i
                                  style={{
                                    width: (step.conversion ?? 0) * 100 + "%",
                                  }}
                                />
                              </div>
                              <b>{number(step.sessions)}</b>
                              <span>
                                {percent(step.conversion)}
                                <small>of entries</small>
                              </span>
                              <span>
                                {i
                                  ? `${number(step.lost)} not observed`
                                  : "Entry sessions"}
                                <small>
                                  {i
                                    ? percent(step.fromPrevious) +
                                      " from previous step"
                                    : "Denominator"}
                                </small>
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="real-note">
                          {scope.funnel === "assessment"
                            ? "Every chain must retain the same assessment type. No attempt UUID is recorded, so this is a session conversion, not an attempt completion rate. Any qualifying entry within the period can contribute a chain; multiple attempts still count once per session."
                            : "Client purchase_success is not a verified transaction or revenue. This funnel cannot establish paid acquisition attribution."}{" "}
                          Later steps may fall after the selected period, within
                          24 hours. Strictly later client timestamps establish
                          order.
                        </p>
                        <p className="real-note">
                          {data.funnel.censored} entry sessions have an
                          unfinished observation window at the snapshot cutoff.{" "}
                          {data.funnel.equalTimeCandidates} equal-time step
                          candidates cannot establish order.{" "}
                          {data.funnel.missingTypeEntries} assessment entries
                          lack a type.
                        </p>
                      </Panel>
                    )}
                  </>
                )}
                {scope.tab === "retention" && (
                  <div className="real-unavailable-grid">
                    <Panel
                      title="User retention · unavailable"
                      detail="Identity quality gate"
                    >
                      <div className="real-state">
                        <span className="real-gate">
                          INSUFFICIENT TELEMETRY
                        </span>
                        <h3>No reliable returning-user denominator</h3>
                        <p>
                          {data.quality.anonymousIds} anonymous IDs were
                          recorded across the source, but{" "}
                          {data.quality.fragmentedSessions} sessions use
                          multiple IDs. Joining these into people would invent
                          identity continuity.
                        </p>
                        <p>
                          Required: a concurrency-safe persistent installation
                          identity, explicit reset semantics and verified
                          identity continuity. No retrospective identity
                          stitching has been applied.
                        </p>
                      </div>
                    </Panel>
                    <Panel
                      title="First-open cohorts · unavailable"
                      detail="Cohort eligibility gate"
                    >
                      <div className="real-state">
                        <span className="real-gate">INCOMPLETE COVERAGE</span>
                        <h3>First opens do not establish a complete cohort</h3>
                        <p>
                          {data.quality.idsWithoutFirstOpen} of{" "}
                          {data.quality.anonymousIds} recorded IDs have no
                          first-open event. First observed activity cannot be
                          relabeled as installation.
                        </p>
                        <p>
                          Required: delivery-safe first-open events, event
                          UUIDs, schema versions, ingestion completeness and
                          mature observation windows. No retention percentages
                          or cohort heatmap have been fabricated.
                        </p>
                      </div>
                    </Panel>
                  </div>
                )}
                {scope.tab === "events" && (
                  <Panel
                    title="Event Explorer"
                    detail="Actual captured rows · session counts are distinct recorded session IDs, never people"
                  >
                    <div className="real-inline">
                      <form
                        key={scope.query}
                        onSubmit={(e) => {
                          e.preventDefault();
                          patch({
                            q: String(
                              new FormData(e.currentTarget).get("q") || "",
                            ),
                          });
                        }}
                      >
                        <input
                          name="q"
                          aria-label="Search event names"
                          placeholder="Find an event…"
                          defaultValue={scope.query}
                        />
                        <button type="submit">Search events</button>
                      </form>
                      <span>
                        Catalogued events with no records remain visible as 0
                        recorded.
                      </span>
                    </div>
                    <div className="real-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Event name</th>
                            <th>Recorded rows</th>
                            <th>Previous rows</th>
                            <th>Recorded sessions</th>
                            <th>Latest client event · UTC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.eventRows.map((row) => (
                            <tr key={row.name}>
                              <td>
                                <code>{row.name}</code>
                                <small>
                                  {row.catalogued
                                    ? "Catalogued"
                                    : "Outside catalog"}
                                </small>
                              </td>
                              <td>{number(row.events)}</td>
                              <td>{number(row.previousEvents)}</td>
                              <td>{number(row.sessions)}</td>
                              <td>
                                {row.lastSeen
                                  ? stamp(row.lastSeen)
                                  : "No records in scope"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data.eventRows.length && (
                        <p className="real-note">
                          No event names match this search.
                        </p>
                      )}
                    </div>
                    <p className="real-note">
                      Only allowlisted segmentation fields are exposed. Raw
                      identity IDs, assessment results, question answers and
                      free-text properties are not sent to this interface.
                    </p>
                  </Panel>
                )}
                {scope.tab === "quality" && (
                  <>
                    <div className="real-unavailable-grid">
                      <Panel
                        title="Source-to-database reconciliation"
                        detail="Full restored source, before period and segment filters"
                      >
                        <dl className="real-definition">
                          <dt>Supabase project</dt>
                          <dd>{data.source.project}</dd>
                          <dt>InnerType source rows</dt>
                          <dd>{number(data.source.sourceRows)}</dd>
                          <dt>Restored rows loaded</dt>
                          <dd>{number(data.source.loadedRows)}</dd>
                          <dt>Production event rows</dt>
                          <dd>{number(data.quality.rows)}</dd>
                          <dt>Excluded non-production rows</dt>
                          <dd>{data.source.excludedNonProduction}</dd>
                          <dt>Source period</dt>
                          <dd>
                            {day(data.quality.firstEvent!)} →{" "}
                            {day(data.quality.lastEvent!)}
                          </dd>
                          <dt>Source contract</dt>
                          <dd>{data.quality.schemaVersion}</dd>
                          <dt>Transport</dt>
                          <dd>
                            REST GET → isolated PostgreSQL → SELECT-only role
                          </dd>
                          <dt>Backup proof</dt>
                          <dd>
                            Scoped dump + second isolated restore passed; full
                            managed-project restore unverified
                          </dd>
                        </dl>
                      </Panel>
                      <Panel
                        title="Measurement quality"
                        detail="Aggregate diagnostics across the restored production source"
                      >
                        <dl className="real-definition">
                          <dt>Recorded session UUIDs</dt>
                          <dd>{number(data.quality.sessions)} · not users</dd>
                          <dt>Sessions with multiple anonymous IDs</dt>
                          <dd>{number(data.quality.fragmentedSessions)}</dd>
                          <dt>Recorded anonymous IDs</dt>
                          <dd>
                            {number(data.quality.anonymousIds)} · unverified
                            continuity
                          </dd>
                          <dt>IDs without a recorded first open</dt>
                          <dd>{number(data.quality.idsWithoutFirstOpen)}</dd>
                          <dt>Possible exact retry duplicates</dt>
                          <dd>
                            {number(data.quality.possibleDuplicateRows)} ·
                            retained
                          </dd>
                          <dt>Missing catalog-required values</dt>
                          <dd>{data.quality.missingRequiredProperties}</dd>
                          <dt>Rows outside catalog</dt>
                          <dd>{data.quality.unknownCatalogRows}</dd>
                          <dt>Delivery lag · median / p99</dt>
                          <dd>
                            {data.quality.lagMedianSeconds?.toFixed(1)} sec /{" "}
                            {(data.quality.lagP99Seconds! / 3600).toFixed(1)}{" "}
                            hours
                          </dd>
                          <dt>Completeness</dt>
                          <dd>Unverified · no heartbeat</dd>
                        </dl>
                      </Panel>
                    </div>
                    <Panel title="Next instrumentation gates">
                      <ol className="real-checklist">
                        <li>
                          Coalesce installation-ID initialization and explicitly
                          mark persistent-storage failures.
                        </li>
                        <li>
                          Assign a stable UUID and schema version before an
                          event enters the queue; make server ingestion
                          idempotent.
                        </li>
                        <li>
                          Acknowledge accepted and rejected events individually;
                          make first-open delivery retry-safe.
                        </li>
                        <li>
                          Verify collector deployment, environment validation
                          and coverage heartbeats.
                        </li>
                        <li>
                          Reconcile purchases to verified transactions before
                          introducing revenue metrics.
                        </li>
                      </ol>
                    </Panel>
                  </>
                )}
                <footer className="real-footnote">
                  <p>{data.segmentation}</p>
                  <p>
                    Measurement boundaries: client first opens ≠ App Store
                    downloads ≠ Apple Ads attributed downloads. Client source
                    tags and purchase signals are not validated attribution or
                    revenue.
                  </p>
                  <p>
                    Contract {data.contract} · source archive hash{" "}
                    <code>{data.source.hash.slice(0, 16)}…</code>
                  </p>
                </footer>
              </>
            )}
          </main>
        </div>
      </div>
      {command && (
        <dialog
          ref={dialog}
          className="real-command"
          aria-label="Jump to an analysis"
          onCancel={() => setCommand(false)}
        >
          <div>
            <button ref={close} onClick={() => setCommand(false)}>
              Close · Esc
            </button>
            <h2>InnerType analyses</h2>
            {Object.entries(TABS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  patch({ tab: key });
                  setCommand(false);
                }}
              >
                {label} →
              </button>
            ))}
          </div>
        </dialog>
      )}
    </div>
  );
}
