"use client";
import { useState } from "react";
import type { SignalSnapshot } from "@/lib/signal/snapshot";
import { JOURNEYS, human } from "@/lib/signal/fixtures";
import {
  RETURN_EVENTS,
  ENTRY_EVENTS,
  type SignalScope,
} from "@/lib/signal/contracts";
const number = (n: number) => n.toLocaleString("en-GB"),
  pct = (n: number | null) => (n === null ? "—" : (100 * n).toFixed(1) + "%");
export function ProductViews({
  data,
  patch,
  inspect,
}: {
  data: SignalSnapshot;
  patch: (v: Partial<SignalScope>) => void;
  inspect: (title: string, detail: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const s = data.scope,
    start = JOURNEYS[s.app].includes(s.startEvent)
      ? s.startEvent
      : JOURNEYS[s.app][0],
    paths = data.paths,
    filtered = data.eventSummary.filter((e) =>
      human(e.name).toLowerCase().includes(s.query.toLowerCase()),
    );
  const active = new Set(data.events.map((e) => e.installId).filter(Boolean))
      .size,
    sessions = new Set(data.events.map((e) => e.installId + ":" + e.sessionId))
      .size;
  const mature = data.cohorts.filter((c) => c.cells[1].rate !== null),
    retained = mature.reduce((a, c) => a + (c.cells[1].returned ?? 0), 0),
    eligible = mature.reduce((a, c) => a + c.size, 0);
  const nodes = paths.nodes.map((n) => {
    const column = paths.nodes.filter((a) => a.step === n.step),
      idx = column.indexOf(n);
    return {
      ...n,
      x: 28 + n.step * (820 / Math.max(1, s.steps)),
      y: 65 + (idx * 230) / Math.max(1, column.length),
      width: 170,
      height: 58,
    };
  });
  return (
    <>
      <div className="sig-stats">
        <Stat
          label="Active installations"
          value={number(active)}
          note="Pseudonymous app instances · not people"
        />
        <Stat
          label="Observed sessions"
          value={number(sessions)}
          note="App + installation + session identity"
        />
        <Stat
          label="D7 return"
          value={pct(eligible ? retained / eligible : null)}
          note={`${number(eligible)} mature cohort installations · exact day`}
        />
        <Stat
          label="Verified proceeds"
          value="Unavailable"
          note="RevenueCat / ASC reconciliation required"
        />
      </div>
      <div
        className="sig-tabs"
        role="tablist"
        aria-label="Product analytics views"
      >
        {(["paths", "funnels", "retention", "events"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={s.productTab === tab}
            onClick={() => patch({ productTab: tab, query: "" })}
          >
            {
              {
                paths: "User journeys",
                funnels: "Funnels",
                retention: "Retention & cohorts",
                events: "Events explorer",
              }[tab]
            }
          </button>
        ))}
      </div>
      <div className="sig-definition">
        <span className="sig-state-dot" />{" "}
        {s.identity === "install"
          ? "Anonymous installations"
          : "App-scoped sessions"}{" "}
        · UTC event time · {s.horizon}h conversion/path horizon ·{" "}
        {data.coverage.complete
          ? "Complete fixture window"
          : "Incomplete fixture coverage"}
        <span>
          {" "}
          ·{" "}
          {
            new Set(
              data.events
                .filter((e) => e.name === JOURNEYS[s.app][0])
                .map((e) => e.installId),
            ).size
          }{" "}
          new observed installations ·{" "}
          {Math.max(
            0,
            active -
              new Set(
                data.events
                  .filter((e) => e.name === JOURNEYS[s.app][0])
                  .map((e) => e.installId),
              ).size,
          )}{" "}
          returning installations
        </span>
        <button
          onClick={() =>
            inspect(
              "Metric definitions",
              data.coverage.warnings.join("\n") +
                "\nDeduplication: app-scoped event ID. Closed ordered funnels. Exact-day " +
                RETURN_EVENTS[s.app] +
                " retention; immature cells stay unavailable.",
            )
          }
        >
          Definitions ↗
        </button>
      </div>
      {s.productTab === "paths" ? (
        <section className="sig-panel">
          <div className="sig-panel-head">
            <div>
              <h2>What happens after the first step?</h2>
              <p>
                Observed event paths · click a node or connection to inspect the
                evidence.
              </p>
            </div>
            <select
              aria-label="Path direction"
              value={s.direction}
              onChange={(e) =>
                patch({ direction: e.target.value as "next" | "previous" })
              }
            >
              <option value="next">Following steps →</option>
              <option value="previous">← Preceding steps</option>
            </select>
          </div>
          <div className="sig-toolbar">
            <label>
              Start event
              <select
                aria-label="Starting event"
                value={start}
                onChange={(e) => patch({ startEvent: e.target.value })}
              >
                {JOURNEYS[s.app].map((n) => (
                  <option key={n} value={n}>
                    {human(n)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Steps
              <select
                aria-label="Path steps"
                value={s.steps}
                onChange={(e) => patch({ steps: Number(e.target.value) })}
              >
                {[2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Horizon
              <select
                aria-label="Time horizon"
                value={s.horizon}
                onChange={(e) => patch({ horizon: Number(e.target.value) })}
              >
                {[1, 24, 168].map((n) => (
                  <option key={n} value={n}>
                    {n} hours
                  </option>
                ))}
              </select>
            </label>
            <label>
              Count
              <select
                aria-label="Analytics identity"
                value={s.identity}
                onChange={(e) =>
                  patch({ identity: e.target.value as SignalScope["identity"] })
                }
              >
                <option value="install">Installations</option>
                <option value="session">Sessions</option>
              </select>
            </label>
            <span className="sig-fine">
              One first-matching path per selected identity
            </span>
          </div>
          <div className="sig-flow-scroll">
            <svg
              className="sig-flow"
              viewBox={`0 0 ${(s.steps * 820) / Math.max(1, s.steps) + 230} 380`}
              role="img"
              aria-label="Observed event transitions, branching and observation boundaries"
            >
              {nodes
                .filter(
                  (n, i) => nodes.findIndex((a) => a.step === n.step) === i,
                )
                .map((n) => (
                  <text
                    className="sig-flow-axis"
                    key={"label" + n.step + n.name}
                    x={n.x}
                    y={27}
                  >
                    STEP {n.step + 1}
                  </text>
                ))}
              {paths.edges.map((edge, i) => {
                const from = nodes.find(
                    (n) => n.step === edge.step && n.name === edge.from,
                  ),
                  to = nodes.find(
                    (n) => n.step === edge.step + 1 && n.name === edge.to,
                  );
                if (!from || !to) return null;
                const x = from.x + 170,
                  y = from.y + 29,
                  X = to.x,
                  Y = to.y + 29;
                return (
                  <path
                    className="sig-flow-edge"
                    key={i}
                    d={`M${x} ${y} C${(x + X) / 2} ${y} ${(x + X) / 2} ${Y} ${X} ${Y}`}
                    strokeWidth={Math.max(4, Math.min(28, edge.identities / 4))}
                    role="button"
                    tabIndex={0}
                    aria-label={`${human(edge.from)} to ${human(edge.to)}: ${edge.identities} ${s.identity}s`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        inspect(
                          "Observed transition",
                          `${human(edge.from)} → ${human(edge.to)}\n${edge.transitions} transitions, ${edge.identities} distinct ${s.identity} identities in the selected scope.\nThis describes recorded events within the horizon; missing next events do not establish churn.`,
                        );
                    }}
                    onClick={() =>
                      inspect(
                        "Observed transition",
                        `${human(edge.from)} → ${human(edge.to)}\n${edge.transitions} transitions · ${edge.identities} distinct ${s.identity} identities.\nFirst matching path per identity; no next event is an observation boundary, not a measured churn event.`,
                      )
                    }
                  />
                );
              })}
              {nodes.map((n) => (
                <g
                  className={
                    "sig-flow-node " +
                    (n.name === "No next event" ? "sig-flow-drop" : "")
                  }
                  role="button"
                  tabIndex={0}
                  key={n.step + n.name}
                  aria-label={`${human(n.name)}, ${n.identities} ${s.identity}s`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      inspect(
                        human(n.name),
                        `${n.identities} ${s.identity} identities reached this step. Source: synthetic ordered events; UTC; ${s.horizon}h horizon.`,
                      );
                  }}
                  onClick={() =>
                    inspect(
                      human(n.name),
                      `${n.identities} distinct ${s.identity} identities at step ${n.step + 1}.\nEvents: ${data.events.filter((e) => e.name === n.name).length} recorded instances of this event in scope.\nNode membership and total event frequency are different measures.`,
                    )
                  }
                >
                  <rect x={n.x} y={n.y} width={170} height={58} rx={7} />
                  <rect
                    className="sig-flow-accent"
                    x={n.x}
                    y={n.y}
                    width={3}
                    height={58}
                    rx={1}
                  />
                  <text x={n.x + 13} y={n.y + 22}>
                    {human(n.name).length > 22
                      ? human(n.name).slice(0, 21) + "…"
                      : human(n.name)}
                  </text>
                  <text className="sig-flow-value" x={n.x + 13} y={n.y + 43}>
                    {number(n.identities)}{" "}
                    <tspan>
                      {s.identity === "install" ? "installations" : "sessions"}
                    </tspan>
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="sig-panel-footer">
            No next event = none observed within this horizon. App Store
            aggregate reports cannot reconstruct these paths.
            <button onClick={() => patch({ productTab: "funnels" })}>
              Compare the ordered funnel ↗
            </button>
          </div>
        </section>
      ) : null}
      {s.productTab === "funnels" ? (
        <section className="sig-panel">
          <div className="sig-panel-head">
            <div>
              <h2>
                {s.app === "pois"
                  ? "Activation to subscription"
                  : "Test to premium unlock"}
              </h2>
              <p>
                Closed, ordered funnel · one conversion per {s.identity} ·{" "}
                {s.horizon}h from entry · not event-count ratios
              </p>
            </div>
            <button onClick={() => setEditing(!editing)}>
              Configure steps
            </button>
            <select
              aria-label="Funnel conversion horizon"
              value={s.horizon}
              onChange={(e) => patch({ horizon: Number(e.target.value) })}
            >
              {[1, 24, 168].map((n) => (
                <option key={n} value={n}>
                  {n} hour window
                </option>
              ))}
            </select>
          </div>
          {editing ? (
            <div className="sig-toolbar sig-funnel-editor">
              {data.funnel.map((r, i) => (
                <label key={i}>
                  Step {i + 1}
                  <select
                    aria-label={"Funnel step " + (i + 1)}
                    value={r.name}
                    onChange={(e) =>
                      patch({
                        funnel: data.funnel.map((r, j) =>
                          j === i ? e.target.value : r.name,
                        ),
                      })
                    }
                  >
                    {JOURNEYS[s.app].map((n) => (
                      <option key={n} value={n}>
                        {human(n)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button
                disabled={data.funnel.length <= 2}
                onClick={() =>
                  patch({ funnel: data.funnel.slice(0, -1).map((r) => r.name) })
                }
              >
                Remove last step
              </button>
              <button onClick={() => patch({ funnel: [] })}>
                Reset app defaults
              </button>
            </div>
          ) : null}
          <div className="sig-funnel">
            {data.funnel.map((r, i) => (
              <button
                className="sig-funnel-row"
                key={r.name + i}
                onClick={() =>
                  inspect(
                    human(r.name),
                    `${r.count} ordered ${s.identity} conversions.\nStage conversion: ${pct(r.conversion)}. Drop-off: ${r.dropoff}. Median time from prior step: ${r.medianMinutes === null ? "unavailable" : r.medianMinutes.toFixed(1) + " minutes"}.\n${r.name.includes("purchase") || r.name.includes("subscription") ? "Client event fixture only. Settled revenue and entitlements require reconciliation." : ""}`,
                  )
                }
              >
                <span className="sig-step-index">{i + 1}</span>
                <span>
                  <strong>{human(r.name)}</strong>
                  <small>
                    {r.name.includes("purchase") ||
                    r.name.includes("subscription")
                      ? "Client signal · not verified money"
                      : i
                        ? "Median " +
                          (r.medianMinutes ?? "—") +
                          " min from prior"
                        : "Eligible entry identities"}
                  </small>
                </span>
                <span className="sig-funnel-track">
                  <i
                    style={{
                      width:
                        (data.funnel[0]?.count
                          ? (r.count / data.funnel[0].count) * 100
                          : 0) + "%",
                    }}
                  />
                </span>
                <strong>{number(r.count)}</strong>
                <span>
                  {pct(r.conversion)}
                  <small>{r.dropoff} dropped</small>
                </span>
                <span className="sig-prior">
                  {s.compare
                    ? data.priorComparable
                      ? number(data.previousFunnel[i]?.count ?? 0) + " prior"
                      : "Prior unavailable"
                    : "Compare off"}
                </span>
              </button>
            ))}
          </div>
          <div className="sig-panel-footer">
            Repeated starts never inflate the denominator. Entries without a
            complete conversion horizon are excluded.
            <button
              onClick={() =>
                inspect(
                  "Funnel configuration",
                  JOURNEYS[s.app].map(human).join(" → ") +
                    "\nApp-specific configuration is defined in JOURNEYS; InnerType names were observed in a bounded source audit; POIS/LoveType names remain proposed. All counts are synthetic. Confirm full event schema before enabling live reporting.",
                )
              }
            >
              Inspect step definitions ↗
            </button>
          </div>
        </section>
      ) : null}
      {s.productTab === "retention" ? (
        <section className="sig-panel">
          <div className="sig-panel-head">
            <div>
              <h2>Do installations come back?</h2>
              <p>
                Selected-window {ENTRY_EVENTS[s.app]} cohorts →{" "}
                {RETURN_EVENTS[s.app]} on exact D1, D7 or D30 · UTC ·
                installation identity
              </p>
            </div>
            <button onClick={() => patch({ cohort: "" })}>
              Clear cohort filter
            </button>
          </div>
          <div className="sig-table-scroll sig-cohort-scroll">
            <table className="sig-cohort">
              <thead>
                <tr>
                  <th>First-open cohort</th>
                  <th>Installations</th>
                  {[1, 7, 30].map((d) => (
                    <th key={d}>Day {d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts
                  .filter((c) => c.size && (!s.cohort || c.date === s.cohort))
                  .map((c) => (
                    <tr
                      key={c.date}
                      className={s.cohort === c.date ? "is-selected" : ""}
                    >
                      <td>
                        <button onClick={() => patch({ cohort: c.date })}>
                          {c.date}
                        </button>
                      </td>
                      <td>{number(c.size)}</td>
                      {c.cells.map((cell) => (
                        <td key={cell.day}>
                          <button
                            className={
                              "sig-heat " +
                              (!cell.complete ? "sig-immature" : "")
                            }
                            style={
                              cell.rate !== null
                                ? ({
                                    "--heat": String(0.08 + cell.rate * 0.55),
                                  } as React.CSSProperties)
                                : undefined
                            }
                            onClick={() =>
                              inspect(
                                `Day ${cell.day} · ${c.date}`,
                                `Cohort size ${c.size} installations. Return date ${cell.target}.\n${cell.complete ? `${cell.returned} observed ${RETURN_EVENTS[s.app]} returns: ${pct(cell.rate)}.` : !cell.mature ? "Window not yet mature. No percentage is inferred." : "Incomplete observation coverage. No percentage is inferred."}\nActivity definition: exact-day ${RETURN_EVENTS[s.app]}, UTC; app-scoped installation identity.`,
                              )
                            }
                            aria-label={`${c.date} day ${cell.day}: ${cell.complete ? pct(cell.rate) : !cell.mature ? "Not mature" : "Incomplete data"}`}
                          >
                            {cell.complete
                              ? pct(cell.rate)
                              : !cell.mature
                                ? "Not mature"
                                : "Incomplete"}
                            {cell.complete ? (
                              <small>
                                {cell.returned} / {c.size}
                              </small>
                            ) : null}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="sig-panel-footer">
            Shaded cells are observed returns. Unmatured and incomplete cells
            remain unavailable. All cohorts are generated fixtures.
          </div>
        </section>
      ) : null}
      {s.productTab === "events" ? (
        <section className="sig-panel">
          <div className="sig-panel-head">
            <div>
              <h2>Inspect what was actually recorded</h2>
              <p>
                Whitelisted properties only · versions and country are captured
                fixture fields · no inferred acquisition attribution
              </p>
            </div>
            <input
              aria-label="Search product events"
              placeholder="Search events…"
              value={s.query}
              onChange={(e) => patch({ query: e.target.value })}
            />
          </div>
          <div className="sig-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Events</th>
                  <th>Installations</th>
                  <th>Sessions</th>
                  <th>Schema / versions</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <button
                        className="sig-link"
                        onClick={() =>
                          inspect(
                            human(e.name),
                            `${e.count} events · ${e.installs} distinct installations · ${e.sessions} sessions.\nSchema v1. Versions: ${e.versions.join(", ")}. Countries: ${e.countries.join(", ")}.\nAllowed properties: locale and cue. Attribution is not captured.\n${e.name.includes("purchase") ? "Client purchase-success events are not settled proceeds." : ""}`,
                          )
                        }
                      >
                        {e.name}
                      </button>
                    </td>
                    <td>{number(e.count)}</td>
                    <td>{number(e.installs)}</td>
                    <td>{number(e.sessions)}</td>
                    <td>v1 · {e.versions.join(", ")}</td>
                    <td>
                      <span className="sig-badge">Sample events</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <div className="sig-section-head">
        <h2>Continue the investigation</h2>
        <span>Context stays with the view</span>
      </div>
      <div className="sig-insights">
        <article>
          <span>01 · COVERAGE</span>
          <h3>Check the instrumentation first</h3>
          <p>
            Installation IDs, session IDs, event time and deduplication must be
            validated before real conversion can be reported.
          </p>
        </article>
        <article>
          <span>02 · MONETIZATION</span>
          <h3>Separate intent from proceeds</h3>
          <p>
            Trial and purchase signals are behavioral events. Revenue and active
            entitlements require RevenueCat or App Store verification.
          </p>
        </article>
        <article>
          <span>03 · EXPERIMENT</span>
          <h3>Turn the drop-off into a hypothesis</h3>
          <p>
            Record a scoped intervention and success criterion. A coincident
            version change cannot establish causality.
          </p>
          <button
            onClick={() =>
              inspect(
                "Experiment planning",
                `App ${s.app} · ${s.country} · ${s.productTab} · ${s.horizon}h horizon.\nRecord a hypothesis, primary metric, success criterion and evaluation date before acting. This milestone contains no live experiment launcher.`,
              )
            }
          >
            Start from this view ↗
          </button>
        </article>
      </div>
    </>
  );
}
export function Stat({
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
