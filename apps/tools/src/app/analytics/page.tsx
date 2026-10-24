import LegacyScreen from "./legacy-screen";
import { SignalPage } from "@/components/signal/signal-page";
import { localSnapshotEnabled } from "@/lib/product-analytics/contracts";
import { signalEnabled, fixturePreviewAllowed } from "@/lib/signal/contracts";
import { PageShell } from "@/components/page-shell";
import { PoisLive } from "@/components/product-analytics/pois-live";
import { readPoisReport } from "@/lib/pois-live/source";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
type Params = Promise<Record<string, string | string[] | undefined>>;
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Params;
}) {
  const params = await searchParams;
  const sample = Array.isArray(params.data) ? params.data[0] : params.data;
  const app = Array.isArray(params.app) ? params.app[0] : params.app;
  if (!app || app === "pois") return { title: "POIS · Live Product Analytics | Kopa Tools" };
  if (!signalEnabled(process.env) || params.view === "legacy")
    return { title: "Legacy event counts | Kopa Studio" };
  if (fixturePreviewAllowed(process.env, sample === "sample"))
    return { title: "DEMO · Generated metrics | Kopa Studio" };
  if (localSnapshotEnabled(process.env))
    return {
      title:
        app && app !== "innertype"
          ? "Source unavailable | Kopa Studio"
          : "InnerType · Actual telemetry snapshot | Kopa Studio",
    };
  return { title: "Product Analytics | Kopa Studio" };
}
export default async function Page({ searchParams }: { searchParams: Params }) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  if (params.app === "lovetype") redirect("/lovetype-signals");
  if (!params.app || params.app === "pois") {
    await requireUser();
    const days = params.days === "28" ? 28 : 7;
    const channel = params.channel === "testflight" ? "testflight" : "appstore";
    let report: Awaited<ReturnType<typeof readPoisReport>> | null = null;
    try { report = await readPoisReport(days, channel); } catch { /* Fail closed; no fixture fallback. */ }
    return <PageShell title="Product Analytics">{report
      ? <PoisLive report={report} days={days} />
      : <section className="notice"><h2>POIS source unavailable</h2><p>The private read-only event source could not be queried. No sample or cached metrics have been substituted.</p></section>
    }</PageShell>;
  }
  if (signalEnabled(process.env) && params.view !== "legacy")
    return <SignalPage screen="product" params={params} />;
  return (
    <LegacyScreen
      searchParams={Promise.resolve({
        app: params.app,
        country: params.country,
        period: params.period,
        market: params.market,
        status: params.status,
        title: params.title,
        description: params.description,
        changeType: params.changeType,
        targetMetric: params.targetMetric,
        nextAction: params.nextAction,
      })}
    />
  );
}
