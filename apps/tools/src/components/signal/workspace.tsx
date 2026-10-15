"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStoredJSON } from "@/lib/signal/browser-storage";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  APP_LABELS,
  SCREEN_ROUTES,
  SNAPSHOT,
  parseScope,
  scopeParams,
  windowFor,
  priorWindow,
  type SignalScreen,
  type SignalScope,
} from "@/lib/signal/contracts";
import { buildSampleSnapshot, snapshotExport } from "@/lib/signal/snapshot";
import { acquisitionFixture } from "@/lib/signal/fixtures";
import { rankComparison, cpa, toCSV } from "@/lib/signal/analytics";
import { ProductViews, Stat } from "./product-views";
import { HistoryChart, MARKS, SERIES } from "./history-chart";
const NAMES: Record<SignalScreen, string> = {
    overview: "Overview",
    keywords: "Keywords",
    ads: "Apple Ads",
    product: "Product Analytics",
    experiments: "Experiments",
    sources: "Sources",
  },
  ICONS: Record<SignalScreen, string> = {
    overview: "◫",
    keywords: "⌁",
    ads: "↗",
    product: "⌘",
    experiments: "⊕",
    sources: "▤",
  };
const num = (n: number | null, d = 0) =>
    n === null
      ? "—"
      : n.toLocaleString("en-GB", {
          maximumFractionDigits: d,
          minimumFractionDigits: d,
        }),
  eur = (n: number | null) => (n === null ? "Unavailable" : "€" + num(n, 2));
const EMPTY_PINS: string[] = [];
const EMPTY_VIEWS: { name: string; href: string }[] = [];
type PlanningNote = {
  screen?: SignalScreen;
  hypothesis: string;
  criterion: string;
  evaluation: string;
  scope: SignalScope;
  createdAt: string;
};
const EMPTY_NOTES: PlanningNote[] = [];
type Drawer = {
  title: string;
  detail: string;
  kind?: "save" | "views" | "command" | "note";
};
export function SignalWorkspace({
  screen,
  sample,
  ownerId,
}: {
  screen: SignalScreen;
  sample: boolean;
  ownerId: string;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    queryString = search.toString(),
    data = useMemo(
      () => buildSampleSnapshot(parseScope(new URLSearchParams(queryString))),
      [queryString],
    ),
    scope = data.scope;
  const [drawer, setDrawer] = useState<Drawer | null>(null),
    [highlight, setHighlight] = useState<string>(),
    [metric, setMetric] = useState("downloads"),
    [sort, setSort] = useState<"latest" | "movement" | "name">("latest"),
    [descending, setDescending] = useState(false),
    [message, setMessage] = useState("");
  const storage = "kopa-signal:" + ownerId;
  const [pins, setPins] = useStoredJSON(storage + ":pins", EMPTY_PINS),
    [saved, setSaved] = useStoredJSON(storage + ":views", EMPTY_VIEWS),
    [notes, setNotes] = useStoredJSON(storage + ":notes", EMPTY_NOTES);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setDrawer({ title: "Jump to analysis", detail: "", kind: "command" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const patch = (value: Partial<SignalScope>, replace = false) => {
    const s = {
      ...parseScope(new URLSearchParams(window.location.search)),
      ...value,
    };
    const url = SCREEN_ROUTES[screen] + "?" + scopeParams(s);
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  };
  const href = (key: SignalScreen) =>
    SCREEN_ROUTES[key] + "?" + scopeParams({ ...scope, query: "" });
  const inspect = (title: string, detail: string) =>
    setDrawer({ title, detail });
  const w = windowFor(scope),
    p = priorWindow(scope),
    selected = data.keywords.filter((k) => scope.selected.includes(k.id)),
    primary = selected[0],
    stats = primary ? rankComparison(primary, scope) : null;
  let rows = data.keywords.filter((k) =>
    k.name.toLowerCase().includes(scope.query.toLowerCase()),
  );
  rows = [...rows].sort((a, b) => {
    if (pins.includes(a.id) !== pins.includes(b.id))
      return pins.includes(a.id) ? -1 : 1;
    const A = rankComparison(a, scope),
      B = rankComparison(b, scope),
      av =
        sort === "name"
          ? a.name
          : sort === "movement"
            ? A.movement
            : A.current.last?.rank,
      bv =
        sort === "name"
          ? b.name
          : sort === "movement"
            ? B.movement
            : B.current.last?.rank;
    const n =
      av == null
        ? 1
        : bv == null
          ? -1
          : typeof av === "string"
            ? av.localeCompare(String(bv))
            : Number(av) - Number(bv);
    return descending ? -n : n;
  });
  const toggle = (id: string) => {
    const values = scope.selected.includes(id)
      ? scope.selected.filter((v) => v !== id)
      : [...scope.selected, id];
    if (values.length <= 4) patch({ selected: values });
    else setMessage("Compare up to four keywords at a time.");
  };
  const exportView = () => {
    if (!sample) return;
    const area = screen === "product" ? scope.productTab : screen,
      records = snapshotExport(data, area);
    const blob = new Blob([toCSV(records)], { type: "text/csv;charset=utf-8" }),
      link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "kopa-SAMPLE-" + area + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setMessage("Exported this sample view, definitions and exact scope.");
  };
  const total = (
    field:
      | "downloads"
      | "spend"
      | "taps"
      | "tapDownloads"
      | "viewDownloads"
      | "proceeds",
    previous = false,
  ) =>
    (screen === "ads" ? data.paidSeries : data.acquisition)
      .filter(
        (r) =>
          r.date >= (previous ? p : w).start &&
          r.date <= (previous ? p : w).end,
      )
      .reduce((s, r) => s + r[field], 0);
  const note = () =>
    setDrawer({
      title: "Start an experiment from this evidence",
      detail: `${APP_LABELS[scope.app]} · ${scope.country} · ${w.start} – ${w.end}\n${screen === "product" ? scope.productTab : screen} · ${scope.identity} identity · ${scope.horizon}h horizon\nSource: ${sample ? "synthetic fixture" : "unvalidated source"} · observational planning only`,
      kind: "note",
    });
  return (
    <div className={"signal-app" + (sample ? " sig-sample" : "")}>
      <div className={"sig-review " + (!sample ? "sig-live" : "")}>
        <strong>
          {sample
            ? "DEMO · SYNTHETIC DATA · NOT FROM SUPABASE"
            : "SIGNAL · SOURCE VALIDATION REQUIRED"}
        </strong>
        <span>Signal approved · no live operational actions</span>
        <ThemeToggle ownerId={ownerId} />
      </div>
      <div className="sig-shell">
        <aside className="sig-sidebar">
          <Link href={href("overview")} className="sig-wordmark">
            KOPA<small>STUDIO / SIGNAL</small>
          </Link>
          <nav aria-label="Main navigation">
            {(Object.keys(NAMES) as SignalScreen[]).map((k) => (
              <Link
                key={k}
                aria-current={k === screen ? "page" : undefined}
                href={href(k)}
                title={NAMES[k]}
              >
                <span aria-hidden>{ICONS[k]}</span>
                <b>{NAMES[k]}</b>
              </Link>
            ))}
          </nav>
          <div className="sig-side-footer">
            <span className="sig-avatar">K</span>
            <span>
              Kopa workspace
              <small>
                {sample ? "Independent sample fixture" : "Authenticated owner"}
              </small>
            </span>
          </div>
        </aside>
        <div className="sig-workspace">
          <header className="sig-top">
            <span>
              Workspace <i>/</i> <strong>{NAMES[screen]}</strong>
            </span>
            <button
              onClick={() =>
                setDrawer({
                  title: "Jump to analysis",
                  detail: "",
                  kind: "command",
                })
              }
            >
              Jump to an app or view <kbd>⌘ K</kbd>
            </button>
          </header>
          <main className="sig-main" id="signal-content">
            <div className="sig-title">
              <div>
                <span className="sig-eyebrow">
                  {APP_LABELS[scope.app]} ·{" "}
                  {scope.country === "DE" ? "Germany" : "United States"}
                </span>
                <h1>
                  {
                    {
                      overview: "Follow the movement.",
                      keywords: "Keyword intelligence",
                      ads: "Apple Ads intelligence",
                      product: "Understand the journey.",
                      experiments: "Experiments & changes",
                      sources: "Sources & coverage",
                    }[screen]
                  }
                </h1>
                <p>
                  {
                    {
                      overview: "What changed, and where should you look next?",
                      keywords:
                        "A connected watchlist, historical context and the evidence behind each change.",
                      ads: "Trace spend to mature outcomes with a precise attribution context.",
                      product:
                        "From the first open to a lasting habit. See what your users actually do.",
                      experiments:
                        "Connect a hypothesis to an intervention and a measurable evaluation.",
                      sources:
                        "A clear boundary between complete observations and missing evidence.",
                    }[screen]
                  }
                </p>
              </div>
              <div className="sig-actions">
                <button
                  onClick={() =>
                    setDrawer({
                      title: "Saved analyses",
                      detail: "",
                      kind: "views",
                    })
                  }
                >
                  Saved views ▾
                </button>
                <button
                  onClick={() =>
                    setDrawer({
                      title: "Save this view",
                      detail: "",
                      kind: "save",
                    })
                  }
                >
                  Save view
                </button>
                <button
                  className="sig-primary"
                  onClick={exportView}
                  disabled={!sample}
                >
                  Export view ↓
                </button>
              </div>
            </div>
            <div className="sig-context">
              <label>
                App
                <select
                  aria-label="Selected app"
                  value={scope.app}
                  onChange={(e) =>
                    patch({
                      app: e.target.value as SignalScope["app"],
                      funnel: [],
                      startEvent: "",
                      cohort: "",
                      selected: ["k0", "k1"],
                    })
                  }
                >
                  {Object.entries(APP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Market
                <select
                  aria-label="Selected market"
                  value={scope.country}
                  onChange={(e) =>
                    patch({ country: e.target.value as "DE" | "US" })
                  }
                >
                  <option value="DE">Germany · DE</option>
                  <option value="US">United States · US</option>
                </select>
              </label>
              <label className="sig-device">
                Scope
                <span>
                  {screen === "keywords"
                    ? (scope.country === "DE" ? "de-DE" : "en-US") + " · iPhone"
                    : screen === "product"
                      ? "Captured app events · UTC"
                      : "Native billing EUR · UTC fixture"}
                </span>
              </label>
              <div className="sig-periods">
                {([7, 28, 90] as const).map((d) => (
                  <button
                    key={d}
                    aria-pressed={scope.days === d && !scope.start}
                    onClick={() => patch({ days: d, start: "", end: SNAPSHOT })}
                  >
                    {d}D
                  </button>
                ))}
              </div>
              <label>
                From
                <input
                  type="date"
                  aria-label="Analysis start"
                  min="2026-04-15"
                  max={scope.end}
                  value={w.start}
                  onChange={(e) => {
                    if (e.target.value) patch({ start: e.target.value });
                  }}
                />
              </label>
              <label>
                Through
                <input
                  type="date"
                  aria-label="Analysis end"
                  min={w.start}
                  max={SNAPSHOT}
                  value={scope.end}
                  onChange={(e) => {
                    if (e.target.value) patch({ end: e.target.value });
                  }}
                />
              </label>
              <label>
                Comparison
                <select
                  aria-label="Compare periods"
                  value={scope.compare ? "previous" : "off"}
                  onChange={(e) =>
                    patch({ compare: e.target.value === "previous" })
                  }
                >
                  <option value="previous">Previous period</option>
                  <option value="off">Comparison off</option>
                </select>
              </label>
            </div>
            <div className="sig-reliability">
              <span>
                {w.start} – {w.end}
                {scope.compare ? " vs " + p.start + " – " + p.end : ""}
                {scope.start ? (
                  <button onClick={() => patch({ start: "", end: SNAPSHOT })}>
                    Clear selected range ×
                  </button>
                ) : null}
              </span>
              <span>
                <i className="sig-state-dot" />
                {sample
                  ? "Sample snapshot · last complete " +
                    data.coverage.completeThrough
                  : "Live source not connected · last complete unavailable"}{" "}
                ·{" "}
                {screen === "ads"
                  ? "attribution revisions possible"
                  : "UTC event / observation dates"}
              </span>
              {sample ? (
                <select
                  aria-label="Preview source state"
                  value={scope.state}
                  onChange={(e) =>
                    patch({ state: e.target.value as SignalScope["state"] })
                  }
                >
                  {["complete", "partial", "empty", "stale", "failed"].map(
                    (v) => (
                      <option value={v} key={v}>
                        {v === "complete"
                          ? "Complete sample"
                          : v[0].toUpperCase() + v.slice(1)}
                      </option>
                    ),
                  )}
                </select>
              ) : null}
            </div>
            {!sample ? (
              <div className="sig-empty sig-panel">
                <span>◇</span>
                <h2>Validated live data is not enabled for Signal yet</h2>
                <p>
                  These charts require source-parity and identity checks. No
                  sample numbers are mixed into the live view. The authenticated
                  legacy reports remain available for inspection.
                </p>
                <Link href={SCREEN_ROUTES[screen] + "?view=legacy"}>
                  Open legacy evidence report ↗
                </Link>
              </div>
            ) : scope.state === "failed" || scope.state === "empty" ? (
              <div className="sig-empty sig-panel">
                <span>{scope.state === "failed" ? "!" : "◇"}</span>
                <h2>
                  {scope.state === "failed"
                    ? "The collection did not complete"
                    : "No observations in this account"}
                </h2>
                <p>
                  {scope.state === "failed"
                    ? "No zero is substituted for a failed source. Retain the last complete date and inspect the recovery path."
                    : "Connect a validated source before analyzing a journey. Historical counts cannot be manufactured."}
                </p>
                <Link href={href("sources")}>Inspect source coverage ↗</Link>
              </div>
            ) : (
              <>
                {scope.state !== "complete" ? (
                  <div className="sig-notice">
                    {scope.state === "partial"
                      ? "Partial observation coverage. Gaps are retained; affected retention cells are unavailable."
                      : "Stale observations. Last complete date is shown; no carry-forward is treated as a new measurement."}
                  </div>
                ) : null}
                {screen === "product" ? (
                  <ProductViews data={data} patch={patch} inspect={inspect} />
                ) : null}
                {screen === "keywords" ? (
                  <>
                    <div className="sig-stats">
                      <Stat
                        label="First selected · mean observed rank"
                        value={num(stats?.current.mean ?? null, 1)}
                        note={`${primary?.name ?? "Select a keyword"} · prior ${num(stats?.previous.mean ?? null, 1)}`}
                      />
                      <Stat
                        label="Comparable movement"
                        value={
                          stats?.movement === null || !stats
                            ? "—"
                            : (stats.movement >= 0 ? "↑ " : "↓ ") +
                              num(Math.abs(stats.movement), 1)
                        }
                        note="Previous mean minus current mean"
                      />
                      <Stat
                        label="Volatility"
                        value={
                          num(stats?.current.volatility ?? null, 1) +
                          " positions"
                        }
                        note="Observed standard deviation · descriptive"
                      />
                      <Stat
                        label="Collection coverage"
                        value={
                          stats
                            ? stats.current.collected +
                              " / " +
                              stats.current.expected
                            : "—"
                        }
                        note={
                          stats
                            ? `Prior ${stats.previous.collected}/${stats.previous.expected} · same vendor method`
                            : "No comparable observations"
                        }
                      />
                    </div>
                    <div className="sig-workbench">
                      <section className="sig-panel sig-watchlist">
                        <div className="sig-panel-head">
                          <div>
                            <h2>
                              Tracked watchlist <em>{rows.length}</em>
                            </h2>
                            <p>
                              Select up to four histories. Open a term for
                              evidence.
                            </p>
                          </div>
                        </div>
                        <div className="sig-toolbar">
                          <input
                            aria-label="Search keyword watchlist"
                            placeholder="Search keywords…"
                            value={scope.query}
                            onChange={(e) =>
                              patch({ query: e.target.value }, true)
                            }
                          />
                          <button
                            onClick={() =>
                              patch({
                                selected: rows.slice(0, 4).map((r) => r.id),
                              })
                            }
                          >
                            Plot first 4
                          </button>
                          <button
                            onClick={() => patch({ selected: ["k0", "k1"] })}
                          >
                            Reset
                          </button>
                        </div>
                        <div className="sig-table-scroll">
                          <table aria-label="Keyword watchlist">
                            <thead>
                              <tr>
                                <th>Plot</th>
                                {(["name", "latest", "movement"] as const).map(
                                  (k) => (
                                    <th key={k}>
                                      <button
                                        onClick={() => {
                                          setSort(k);
                                          setDescending(
                                            sort === k ? !descending : false,
                                          );
                                        }}
                                      >
                                        {
                                          {
                                            name: "Keyword",
                                            latest: "Latest",
                                            movement: "Mean Δ",
                                          }[k]
                                        }{" "}
                                        ↕
                                      </button>
                                    </th>
                                  ),
                                )}
                                <th>History</th>
                                <th>Pin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((k) => {
                                const i = Number(k.id.slice(1)) % 4,
                                  c = rankComparison(k, scope),
                                  latest = k.points.find(
                                    (p) => p.date === scope.end,
                                  );
                                return (
                                  <tr
                                    key={k.id}
                                    className={
                                      scope.selected.includes(k.id)
                                        ? "is-selected"
                                        : ""
                                    }
                                    onMouseEnter={() => setHighlight(k.id)}
                                    onMouseLeave={() => setHighlight(undefined)}
                                  >
                                    <td>
                                      <input
                                        aria-label={"Plot " + k.name}
                                        type="checkbox"
                                        checked={scope.selected.includes(k.id)}
                                        onChange={() => toggle(k.id)}
                                      />
                                    </td>
                                    <td>
                                      <button
                                        className="sig-keyword"
                                        onClick={() =>
                                          inspect(
                                            k.name,
                                            `Scope ${APP_LABELS[scope.app]} · ${scope.country} · iPhone\n${w.start} – ${w.end}\nObserved vendor mean ${num(c.current.mean, 1)}; ${c.current.collected}/${c.current.expected} collection days.\n${k.points
                                              .filter(
                                                (p) =>
                                                  p.date >= w.start &&
                                                  p.date <= w.end,
                                              )
                                              .slice(-10)
                                              .map(
                                                (p) =>
                                                  p.date +
                                                  ": " +
                                                  (p.status === "observed"
                                                    ? "#" + p.rank
                                                    : p.status) +
                                                  " · " +
                                                  p.method,
                                              )
                                              .join(
                                                "\n",
                                              )}\nMetadata v1.8 annotation: 23 September. Timing does not prove a causal effect.\nPaid attribution link: unavailable. Competitor rank source: not yet validated.`,
                                          )
                                        }
                                      >
                                        <i style={{ color: SERIES[i] }}>
                                          {MARKS[i]}
                                        </i>
                                        <span>
                                          {k.name}
                                          <small>
                                            {k.intent} ·{" "}
                                            {latest?.method === "itunes_legacy"
                                              ? "legacy iTunes"
                                              : "vendor fixture"}
                                          </small>
                                        </span>
                                      </button>
                                    </td>
                                    <td>
                                      {latest?.status === "observed"
                                        ? "#" + latest.rank
                                        : (latest?.status ?? "Untracked")}
                                    </td>
                                    <td
                                      className={
                                        (c.movement ?? 0) >= 0
                                          ? "sig-positive"
                                          : "sig-negative"
                                      }
                                    >
                                      {c.movement === null
                                        ? "—"
                                        : (c.movement >= 0 ? "↑ " : "↓ ") +
                                          num(Math.abs(c.movement), 1)}
                                    </td>
                                    <td>
                                      <Spark
                                        points={k.points
                                          .filter(
                                            (p) =>
                                              p.date >= w.start &&
                                              p.date <= w.end,
                                          )
                                          .map((p) =>
                                            p.status === "observed" &&
                                            p.method === "vendor_sample"
                                              ? p.rank
                                              : null,
                                          )}
                                        color={SERIES[i]}
                                        rank
                                      />
                                    </td>
                                    <td>
                                      <button
                                        aria-label={"Pin " + k.name}
                                        aria-pressed={pins.includes(k.id)}
                                        onClick={() => {
                                          const next = pins.includes(k.id)
                                            ? pins.filter((v) => v !== k.id)
                                            : [...pins, k.id];
                                          setPins(next);
                                          try {
                                            localStorage.setItem(
                                              storage + ":pins",
                                              JSON.stringify(next),
                                            );
                                          } catch {}
                                        }}
                                      >
                                        {pins.includes(k.id) ? "★" : "☆"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="sig-panel-footer">
                          Only tracked terms · no full keyword-universe claim
                        </div>
                      </section>
                      <section className="sig-panel sig-history">
                        <div className="sig-panel-head">
                          <div>
                            <h2>How are your keywords moving?</h2>
                            <p>
                              #1 is best · no interpolation through missing
                              observations
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              inspect(
                                "Explain this change",
                                `${scope.selected.length} selected terms · ${w.start} – ${w.end}.\nMeans use only observed vendor positions. Legacy iTunes and gaps are excluded.\nMetadata annotations are context, not causal evidence. No AI service is connected in this milestone.`,
                              )
                            }
                          >
                            Explain ↗
                          </button>
                        </div>
                        <div className="sig-legend">
                          {selected.map((k) => (
                            <button key={k.id} onClick={() => toggle(k.id)}>
                              <i
                                style={{
                                  color: SERIES[Number(k.id.slice(1)) % 4],
                                }}
                              >
                                {MARKS[Number(k.id.slice(1)) % 4]}
                              </i>
                              {k.name}
                            </button>
                          ))}
                          <span>Dashed = prior / legacy labeled</span>
                        </div>
                        <HistoryChart
                          data={data}
                          rank
                          highlight={highlight}
                          selectRange={(start, end) => patch({ start, end })}
                        />
                        <div className="sig-panel-footer">
                          Vendor observation fixture · absent within top 100 is
                          not #101
                          <button
                            onClick={() =>
                              inspect(
                                "Metadata v1.8",
                                "23 September 2026 · sample title/subtitle update.\nThis annotation describes timing. No causal ranking effect is inferred.",
                              )
                            }
                          >
                            Metadata annotation ↗
                          </button>
                        </div>
                      </section>
                    </div>
                  </>
                ) : null}
                {screen === "overview" || screen === "ads" ? (
                  <>
                    <div className="sig-stats">
                      <Stat
                        label={
                          screen === "overview"
                            ? "First-time downloads"
                            : "Ad spend"
                        }
                        value={
                          screen === "overview"
                            ? num(total("downloads"))
                            : eur(total("spend"))
                        }
                        note={
                          screen === "overview"
                            ? "ASC-shaped report fixture · not event counts"
                            : "Native EUR · source fixture"
                        }
                      />
                      <Stat
                        label={screen === "overview" ? "Ad spend" : "Taps"}
                        value={
                          screen === "overview"
                            ? eur(total("spend"))
                            : num(total("taps"))
                        }
                        note="Selected complete reporting window"
                      />
                      <Stat
                        label={
                          screen === "overview"
                            ? "Tap CPA"
                            : scope.attribution + "-attributed downloads"
                        }
                        value={
                          screen === "overview"
                            ? eur(cpa(total("spend"), total("tapDownloads")))
                            : num(
                                scope.attribution === "tap"
                                  ? total("tapDownloads")
                                  : scope.attribution === "view"
                                    ? total("viewDownloads")
                                    : total("tapDownloads") +
                                      total("viewDownloads"),
                              )
                        }
                        note="Attribution definition is retained"
                      />
                      <Stat
                        label={
                          screen === "overview"
                            ? "Developer proceeds"
                            : scope.attribution + " CPA"
                        }
                        value={
                          screen === "overview"
                            ? eur(total("proceeds"))
                            : eur(
                                cpa(
                                  total("spend"),
                                  scope.attribution === "tap"
                                    ? total("tapDownloads")
                                    : scope.attribution === "view"
                                      ? total("viewDownloads")
                                      : total("tapDownloads") +
                                        total("viewDownloads"),
                                ),
                              )
                        }
                        note={
                          screen === "overview"
                            ? "Official-report shape · EUR fixture"
                            : "Ratio of totals · not mean daily CPA"
                        }
                      />
                    </div>
                    <div className="sig-workbench">
                      <section className="sig-panel sig-watchlist">
                        <div className="sig-panel-head">
                          <div>
                            <h2>
                              {screen === "overview"
                                ? "Apps in this workspace"
                                : {
                                    campaign: "Campaigns",
                                    group: "Ad groups",
                                    keyword: "Targeting keywords",
                                    term: "Reported search terms",
                                  }[scope.adsLevel]}
                            </h2>
                            <p>
                              {screen === "overview"
                                ? "Open an app to continue the investigation"
                                : "Read-only hierarchy · actual query ≠ targeting keyword"}
                            </p>
                          </div>
                        </div>
                        {screen === "ads" ? (
                          <div className="sig-toolbar">
                            <button
                              onClick={() =>
                                patch({ adsLevel: "campaign", parent: "" })
                              }
                            >
                              Campaigns
                            </button>
                            {scope.adsLevel !== "campaign" ? (
                              <button
                                onClick={() => patch({ adsLevel: "group" })}
                              >
                                Ad group
                              </button>
                            ) : null}
                            <select
                              aria-label="Attribution type"
                              value={scope.attribution}
                              onChange={(e) =>
                                patch({
                                  attribution: e.target
                                    .value as SignalScope["attribution"],
                                })
                              }
                            >
                              {["tap", "view", "total"].map((v) => (
                                <option value={v} key={v}>
                                  {v} attribution
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                        <div className="sig-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Daily trend</th>
                                <th>
                                  {screen === "overview"
                                    ? "Downloads"
                                    : "Spend · EUR"}
                                </th>
                                <th>Evidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {screen === "overview"
                                ? Object.entries(APP_LABELS).map(
                                    ([id, name], i) => (
                                      <tr key={id}>
                                        <td>
                                          <button
                                            className="sig-link"
                                            onClick={() =>
                                              router.push(
                                                SCREEN_ROUTES.keywords +
                                                  "?" +
                                                  scopeParams({
                                                    ...scope,
                                                    app: id as SignalScope["app"],
                                                  }),
                                              )
                                            }
                                          >
                                            {name} ↗
                                          </button>
                                        </td>
                                        <td>
                                          <Spark
                                            points={data.acquisition
                                              .filter(
                                                (p) =>
                                                  p.date >= w.start &&
                                                  p.date <= w.end,
                                              )
                                              .map((p) => p.downloads)}
                                            color={SERIES[i]}
                                          />
                                        </td>
                                        <td>
                                          {num(
                                            acquisitionFixture({
                                              ...scope,
                                              app: id as SignalScope["app"],
                                            })
                                              .filter(
                                                (r) =>
                                                  r.date >= w.start &&
                                                  r.date <= w.end,
                                              )
                                              .reduce(
                                                (a, r) => a + r.downloads,
                                                0,
                                              ),
                                          )}
                                        </td>
                                        <td>
                                          <span className="sig-badge">
                                            Sample report
                                          </span>
                                        </td>
                                      </tr>
                                    ),
                                  )
                                : data.paidRows.map((r, i) => (
                                    <tr key={r.id}>
                                      <td>
                                        <button
                                          className="sig-link"
                                          onClick={() =>
                                            ["campaign", "group"].includes(
                                              scope.adsLevel,
                                            )
                                              ? patch({
                                                  adsLevel:
                                                    scope.adsLevel ===
                                                    "campaign"
                                                      ? "group"
                                                      : "keyword",
                                                  parent:
                                                    scope.parent + "/" + r.id,
                                                })
                                              : inspect(
                                                  r.name,
                                                  "Synthetic Apple Ads evidence. Targeting and actual queries are distinct; suppressed terms do not imply zero spend.",
                                                )
                                          }
                                        >
                                          {r.name} ›
                                        </button>
                                      </td>
                                      <td>
                                        <Spark
                                          points={r.points
                                            .filter(
                                              (p) =>
                                                p.date >= w.start &&
                                                p.date <= w.end,
                                            )
                                            .map((p) => p.spend)}
                                          color={SERIES[i % 4]}
                                        />
                                      </td>
                                      <td>
                                        {eur(
                                          r.points
                                            .filter(
                                              (p) =>
                                                p.date >= w.start &&
                                                p.date <= w.end,
                                            )
                                            .reduce((a, p) => a + p.spend, 0),
                                        )}
                                      </td>
                                      <td>
                                        <span className="sig-badge">
                                          {scope.adsLevel === "term"
                                            ? "Suppression possible"
                                            : "Sample report"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                            </tbody>
                          </table>
                        </div>
                        {screen === "ads" &&
                        ["keyword", "term"].includes(scope.adsLevel) ? (
                          <div className="sig-panel-footer">
                            <button
                              onClick={() => patch({ adsLevel: "keyword" })}
                            >
                              Targeting keywords
                            </button>
                            <button onClick={() => patch({ adsLevel: "term" })}>
                              Reported terms
                            </button>
                          </div>
                        ) : null}
                        <div className="sig-panel-footer">
                          {screen === "ads"
                            ? "Attribution, currency, timezone and suppression belong with the evidence."
                            : "App identities and source mappings must pass the live-data gate."}
                        </div>
                      </section>
                      <section className="sig-panel sig-history">
                        <div className="sig-panel-head">
                          <div>
                            <h2>
                              {screen === "overview"
                                ? "What changed over time?"
                                : "Follow spend. Inspect the outcome."}
                            </h2>
                            <p>
                              {screen === "overview"
                                ? "Daily reports · counts and money have separate modes"
                                : "Single metric per axis · no live campaign writes"}
                            </p>
                          </div>
                          <button onClick={note}>+ Experiment note</button>
                        </div>
                        <div
                          className="sig-tabs"
                          role="tablist"
                          aria-label="Chart metric"
                        >
                          {(screen === "overview"
                            ? ["downloads", "spend", "proceeds"]
                            : ["spend", "taps", "attributedDownloads", "cpa"]
                          ).map((k) => (
                            <button
                              key={k}
                              role="tab"
                              aria-selected={
                                (screen === "ads" && metric === "downloads"
                                  ? "spend"
                                  : metric) === k
                              }
                              onClick={() => setMetric(k)}
                            >
                              {
                                {
                                  downloads: "Downloads",
                                  spend: "Spend · EUR",
                                  proceeds: "Proceeds · EUR",
                                  taps: "Taps",
                                  attributedDownloads: "Attributed downloads",
                                  cpa: "CPA · EUR",
                                }[k]
                              }
                            </button>
                          ))}
                        </div>
                        <HistoryChart
                          data={
                            screen === "ads"
                              ? { ...data, acquisition: data.paidSeries }
                              : data
                          }
                          metric={
                            screen === "ads" && metric === "downloads"
                              ? "spend"
                              : metric
                          }
                          selectRange={(start, end) => patch({ start, end })}
                        />
                        <div className="sig-panel-footer">
                          {scope.compare
                            ? "Dashed series = prior period; actual dates in tooltip"
                            : "Comparator off"}{" "}
                          · monetary values in EUR · fixture UTC
                        </div>
                      </section>
                    </div>
                    {screen === "overview" ? (
                      <section className="sig-panel sig-after">
                        <div>
                          <span className="sig-eyebrow">
                            After the download
                          </span>
                          <h2>Acquisition is only the beginning.</h2>
                          <p>
                            {new Set(data.events.map((e) => e.installId)).size}{" "}
                            active sample installations ·{" "}
                            {data.funnel.at(-1)?.count ?? 0} final-stage
                            behavioral signals. These are separate measures from
                            store downloads and verified proceeds.
                          </p>
                        </div>
                        <Link
                          className="sig-button sig-primary"
                          href={href("product")}
                        >
                          Explore Product Analytics ↗
                        </Link>
                      </section>
                    ) : null}
                    <div className="sig-section-head">
                      <h2>Three places to look next</h2>
                      <span>Evidence before action</span>
                    </div>
                    <div className="sig-insights">
                      {(["keywords", "product", "experiments"] as const).map(
                        (k, i) => (
                          <article key={k}>
                            <span>
                              0{i + 1} · {NAMES[k].toUpperCase()}
                            </span>
                            <h3>
                              {
                                [
                                  "Inspect the ranking shape",
                                  "Find the onboarding drop-off",
                                  "Put changes on the timeline",
                                ][i]
                              }
                            </h3>
                            <p>
                              {
                                [
                                  "Averages can hide missing observations. Compare exact histories and coverage.",
                                  "Follow installation or session identity through ordered events.",
                                  "A dated release is context; its timing alone is not a causal explanation.",
                                ][i]
                              }
                            </p>
                            <Link href={href(k)}>Open {NAMES[k]} ↗</Link>
                          </article>
                        ),
                      )}
                    </div>
                  </>
                ) : null}
                {screen === "experiments" ? (
                  <>
                    <div className="sig-panel-head">
                      <div>
                        <h2>Hypotheses, not automatic actions.</h2>
                        <p>
                          Sample timeline · local planning notes · no experiment
                          launcher
                        </p>
                      </div>
                      <button className="sig-primary" onClick={note}>
                        Record a hypothesis
                      </button>
                    </div>
                    <section className="sig-panel sig-timeline">
                      {notes
                        .filter(
                          (n) =>
                            n.scope.app === scope.app &&
                            n.scope.country === scope.country,
                        )
                        .map((n, i) => (
                          <article key={n.createdAt + i}>
                            <small>
                              {n.evaluation} · Local planning note ·{" "}
                              {APP_LABELS[n.scope.app]} / {n.scope.country}
                            </small>
                            <h2>{n.hypothesis}</h2>
                            <p>Success criterion: {n.criterion}</p>
                            <button
                              onClick={() =>
                                router.push(
                                  SCREEN_ROUTES[n.screen ?? "product"] +
                                    "?" +
                                    scopeParams(n.scope),
                                )
                              }
                            >
                              Reopen analysis ↗
                            </button>
                          </article>
                        ))}
                      {[
                        [
                          "2026-10-07",
                          "Budget review",
                          "Reviewed · sample Ads annotation",
                        ],
                        [
                          "2026-10-03",
                          "Screenshot test",
                          "Awaiting data · observational",
                        ],
                        [
                          "2026-09-23",
                          "Metadata v1.8",
                          "Reviewed · no causal inference",
                        ],
                      ].map(([date, title, status]) => (
                        <article key={date}>
                          <small>
                            {date} · {status}
                          </small>
                          <h2>{title}</h2>
                          <p>
                            Compare a source-complete evaluation window with its
                            baseline. Define the metric and success criterion
                            before interpreting the result.
                          </p>
                          <button
                            onClick={() =>
                              inspect(
                                title,
                                date +
                                  " · " +
                                  status +
                                  "\nThis is a recorded fixture annotation, not proof of an effect. Controlled PPO requires verified allocation and outcome definitions.",
                              )
                            }
                          >
                            Open evidence ↗
                          </button>
                        </article>
                      ))}
                    </section>
                  </>
                ) : null}
                {screen === "sources" ? (
                  <section className="sig-panel">
                    <div className="sig-panel-head">
                      <div>
                        <h2>Can the selected scope be trusted?</h2>
                        <p>
                          All statuses below are preview fixtures. No account
                          connection is implied.
                        </p>
                      </div>
                      <span className="sig-badge">
                        M0 / M1 validation gates
                      </span>
                    </div>
                    <div className="sig-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Source</th>
                            <th>Scope / state</th>
                            <th>Last complete</th>
                            <th>Next step</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            [
                              "Rank observations",
                              "Provider / native source not validated",
                              "Sample only",
                              "Validate storefront, device, sponsored handling and permitted collection",
                            ],
                            [
                              "App Store Connect",
                              "Daily partitions / native money",
                              "Sample only",
                              "Reconcile newest complete report instances and per-unit proceeds",
                            ],
                            [
                              "Apple Ads",
                              "Read-only daily facts",
                              "Sample only",
                              "Validate native currency, timezone, attribution and all pages",
                            ],
                            [
                              "Product events",
                              "Installation / session identity",
                              "Sample only",
                              "Inspect schemas, deduplication and historical identity coverage",
                            ],
                            [
                              "PostHog EU",
                              "Integration candidate · not connected",
                              "—",
                              "Confirm approved region, retention, access and cost cap",
                            ],
                            [
                              "RevenueCat / entitlements",
                              "Not connected",
                              "—",
                              "Reconcile purchase, refund and active entitlement facts",
                            ],
                          ].map((r) => (
                            <tr key={r[0]}>
                              {r.map((c, i) => (
                                <td key={i}>{c}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="sig-panel-footer">
                      No credentials are entered, stored or transmitted by this
                      preview. Read-only typed sample endpoint: /api/signal
                    </div>
                  </section>
                ) : null}
              </>
            )}
            <footer className="sig-bottom">
              Signal · development branch ·{" "}
              {sample
                ? "Synthetic fixtures are visibly separate from live data."
                : "No validated data available in this view."}
              <span>Read-only operations · no production migration</span>
            </footer>
            {message ? (
              <p className="sig-toast" role="status">
                {message}
                <button
                  aria-label="Dismiss message"
                  onClick={() => setMessage("")}
                >
                  ×
                </button>
              </p>
            ) : null}
          </main>
        </div>
      </div>
      {drawer ? (
        <SignalDialog title={drawer.title} close={() => setDrawer(null)}>
          <p className="sig-drawer-detail">{drawer.detail}</p>
          {drawer.kind === "command" ? (
            <div className="sig-command">
              {(Object.keys(NAMES) as SignalScreen[]).map((k) => (
                <Link key={k} href={href(k)} onClick={() => setDrawer(null)}>
                  {ICONS[k]} {NAMES[k]} ↗
                </Link>
              ))}
            </div>
          ) : drawer.kind === "views" ? (
            <div className="sig-command">
              {saved.length ? (
                saved.map((v, i) => (
                  <Link href={v.href} key={i} onClick={() => setDrawer(null)}>
                    {v.name} ↗
                  </Link>
                ))
              ) : (
                <p>No saved views on this owner/browser yet.</p>
              )}
            </div>
          ) : drawer.kind === "save" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget),
                  next = [
                    ...saved,
                    {
                      name: String(form.get("name")),
                      href: SCREEN_ROUTES[screen] + "?" + scopeParams(scope),
                    },
                  ];
                setSaved(next);
                try {
                  localStorage.setItem(
                    storage + ":views",
                    JSON.stringify(next),
                  );
                } catch {
                  setMessage(
                    "Storage unavailable. Copy the view URL to retain this scope.",
                  );
                }
                setDrawer(null);
              }}
            >
              <label>
                View name
                <input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={
                    APP_LABELS[scope.app] +
                    " · " +
                    scope.country +
                    " · " +
                    NAMES[screen]
                  }
                />
              </label>
              <p>
                Owner-scoped browser storage. Filters, definitions and
                comparison remain in the URL.
              </p>
              <button className="sig-primary" type="submit">
                Save local view
              </button>
            </form>
          ) : drawer.kind === "note" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = Object.fromEntries(new FormData(e.currentTarget));
                const ok = setNotes([
                  ...notes,
                  {
                    hypothesis: String(form.hypothesis),
                    criterion: String(form.criterion),
                    evaluation: String(form.evaluation),
                    screen,
                    scope,
                    createdAt: new Date().toISOString(),
                  },
                ]);
                setMessage(
                  ok
                    ? "Hypothesis saved locally. No live change was initiated."
                    : "Local storage unavailable; no note was persisted.",
                );
                setDrawer(null);
              }}
            >
              <label>
                Hypothesis
                <textarea
                  name="hypothesis"
                  required
                  placeholder="If we change…, we expect…"
                />
              </label>
              <label>
                Success criterion
                <input
                  name="criterion"
                  required
                  placeholder="Metric, threshold and evaluation window"
                />
              </label>
              <label>
                Evaluation date
                <input
                  name="evaluation"
                  type="date"
                  required
                  defaultValue="2026-10-25"
                />
              </label>
              <button type="submit" className="sig-primary">
                Save local planning note
              </button>
            </form>
          ) : (
            <>
              <div className="sig-drawer-source">
                <h3>Evidence boundary</h3>
                <p>
                  This milestone displays sample observations. No source
                  integration, verified revenue or causal claim is implied.
                </p>
              </div>
              <button className="sig-primary" onClick={note}>
                Record an experiment hypothesis
              </button>
            </>
          )}
        </SignalDialog>
      ) : null}
    </div>
  );
}
function SignalDialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="sig-dialog"
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <span className="sig-eyebrow">Contextual evidence</span>
        <button aria-label="Close detail" onClick={close}>
          ×
        </button>
      </header>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
function Spark({
  points,
  color,
  rank = false,
}: {
  points: (number | null)[];
  color: string;
  rank?: boolean;
}) {
  const numbers = points.filter((v): v is number => v !== null),
    min = Math.min(...numbers),
    max = Math.max(...numbers);
  const path = points
    .map((v, i) => {
      if (v === null) return "";
      const x = (i / Math.max(1, points.length - 1)) * 76 + 2,
        y = rank
          ? 3 + ((v - min) / (max - min || 1)) * 19
          : 22 - ((v - min) / (max - min || 1)) * 19,
        command = i > 0 && points[i - 1] !== null ? "L" : "M";
      return command + x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
  return (
    <svg viewBox="0 0 80 26" className="sig-spark" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
