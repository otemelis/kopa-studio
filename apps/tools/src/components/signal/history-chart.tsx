"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  Symbols,
} from "recharts";
import { dates, priorWindow, shift, windowFor } from "@/lib/signal/contracts";
import type { SignalSnapshot } from "@/lib/signal/snapshot";
export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
];
export const MARKS = ["●", "◆", "▲", "■"];
export function HistoryChart({
  data,
  rank = false,
  metric = "downloads",
  highlight,
  selectRange,
}: {
  data: SignalSnapshot;
  rank?: boolean;
  metric?: string;
  highlight?: string;
  selectRange?: (start: string, end: string) => void;
}) {
  const scope = data.scope,
    w = windowFor(scope),
    previous = priorWindow(scope),
    days = dates(w.start, w.end),
    rows = days.map((date, i) => {
      const out: Record<string, string | number | null> = {
        date,
        previous: shift(previous.start, i),
      };
      if (rank) {
        for (const series of data.keywords.filter((k) =>
          scope.selected.includes(k.id),
        )) {
          const p = series.points.find((p) => p.date === date),
            b = series.points.find((p) => p.date === out.previous);
          out[series.id] =
            p?.status === "observed" && p.method === "vendor_sample"
              ? p.rank
              : null;
          out[series.id + "-legacy"] =
            p?.status === "observed" && p.method === "itunes_legacy"
              ? p.rank
              : null;
          out[series.id + "-prior"] =
            b?.status === "observed" && b.method === "vendor_sample"
              ? b.rank
              : null;
          out[series.id + "-status"] = p?.status ?? "untracked";
        }
      } else {
        const p = data.acquisition.find((p) => p.date === date),
          b = data.acquisition.find((p) => p.date === out.previous);
        out.value = p
          ? ((p as unknown as Record<string, number>)[metric] ?? null)
          : null;
        out.prior = b
          ? ((b as unknown as Record<string, number>)[metric] ?? null)
          : null;
      }
      return out;
    });
  const series = rank
    ? data.keywords
        .filter((k) => scope.selected.includes(k.id))
        .map((k) => ({
          id: k.id,
          name: k.name,
          color: SERIES[Number(k.id.slice(1)) % 4],
          shape: ["circle", "diamond", "triangle", "square"][
            Number(k.id.slice(1)) % 4
          ] as "circle" | "diamond" | "triangle" | "square",
        }))
    : [
        {
          id: "value",
          name:
            metric === "spend"
              ? "Spend · EUR"
              : metric === "downloads"
                ? "First-time downloads"
                : metric,
          color: SERIES[0],
          shape: "circle" as const,
        },
      ];
  return (
    <div
      className="sig-chart"
      role="group"
      aria-label={
        rank
          ? "Ranking history; rank one at top. Gaps are not interpolated."
          : "Daily " + metric + " history"
      }
    >
      <ResponsiveContainer width="100%" height={320} minWidth={0}>
        <LineChart
          data={rows}
          margin={{ left: -18, right: 12, top: 26, bottom: 6 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--sig-line)" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => String(v).slice(5)}
            stroke="var(--sig-muted)"
            tickLine={false}
            axisLine={false}
            minTickGap={35}
            fontSize={10}
          />
          <YAxis
            reversed={rank}
            domain={rank ? [1, 100] : [0, "auto"]}
            ticks={rank ? [1, 20, 40, 60, 80, 100] : undefined}
            tickFormatter={(v) => (rank ? "#" + v : String(v))}
            stroke="var(--sig-muted)"
            axisLine={false}
            tickLine={false}
            fontSize={10}
          />
          <Tooltip
            filterNull={false}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="sig-tooltip">
                  <strong>{String(label)} · sample</strong>
                  {payload
                    .filter(
                      (p) =>
                        !String(p.dataKey).includes("legacy") ||
                        p.value != null,
                    )
                    .map((p) => (
                      <p key={String(p.dataKey)}>
                        <span>{String(p.name)}</span>
                        <b>
                          {rank && p.value != null ? "#" : ""}
                          {p.value == null
                            ? "Unobserved"
                            : typeof p.value === "number"
                              ? p.value.toFixed(rank ? 0 : 1)
                              : String(p.value)}
                        </b>
                      </p>
                    ))}
                  {rank &&
                    series.map((s) => (
                      <small key={s.id}>
                        {s.name}:{" "}
                        {String(payload[0]?.payload?.[s.id + "-status"])}
                      </small>
                    ))}
                  <small>
                    {rank
                      ? "Sample methods labeled · legacy iTunes differs from vendor"
                      : "Synthetic official-report shape · EUR when monetary"}
                  </small>
                  <small>
                    Comparator date: {String(payload[0]?.payload?.previous)} ·
                    no causal inference
                  </small>
                </div>
              ) : null
            }
          />
          {["2026-09-23", "2026-10-03"]
            .filter((d) => d >= w.start && d <= w.end)
            .map((date) => (
              <ReferenceLine
                key={date}
                x={date}
                stroke="var(--sig-muted)"
                strokeDasharray="3 5"
                label={{
                  value:
                    date === "2026-10-03" ? "Screenshot test" : "Metadata v1.8",
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: "var(--sig-muted)",
                }}
              />
            ))}
          {series.flatMap((s) => [
            <Line
              key={s.id}
              name={s.name}
              dataKey={s.id}
              stroke={s.color}
              strokeWidth={highlight && highlight !== s.id ? 1 : 2}
              opacity={highlight && highlight !== s.id ? 0.3 : 1}
              connectNulls={false}
              isAnimationActive={false}
              dot={({ cx, cy, index }) =>
                index === rows.length - 1 ? (
                  <Symbols
                    key={index}
                    cx={cx}
                    cy={cy}
                    type={s.shape}
                    size={35}
                    fill="var(--sig-surface)"
                    stroke={s.color}
                  />
                ) : (
                  <circle key={index} r={0} />
                )
              }
              activeDot={{ r: 4 }}
            />,
            ...(rank
              ? [
                  <Line
                    key={s.id + "legacy"}
                    name={s.name + " · legacy iTunes"}
                    dataKey={s.id + "-legacy"}
                    stroke={s.color}
                    strokeDasharray="2 5"
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />,
                ]
              : []),
            ...(scope.compare
              ? [
                  <Line
                    key={s.id + "prior"}
                    name={s.name + " · previous"}
                    dataKey={rank ? s.id + "-prior" : "prior"}
                    stroke={s.color}
                    strokeDasharray="5 5"
                    opacity={0.48}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />,
                ]
              : []),
          ])}
          <Brush
            ariaLabel={`Select analysis date range, ${w.start} through ${w.end}; use arrow keys or the From and Through date controls`}
            dataKey="date"
            height={20}
            stroke="var(--sig-muted)"
            fill="var(--sig-soft)"
            tickFormatter={(v) => String(v).slice(5)}
            onChange={(r) => {
              if (
                selectRange &&
                r.startIndex !== undefined &&
                r.endIndex !== undefined &&
                r.endIndex > r.startIndex &&
                r.endIndex - r.startIndex < rows.length - 1
              )
                selectRange(days[r.startIndex], days[r.endIndex]);
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
