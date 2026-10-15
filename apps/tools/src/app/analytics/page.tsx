import LegacyScreen from "./legacy-screen";
import { SignalPage } from "@/components/signal/signal-page";
import { localSnapshotEnabled } from "@/lib/product-analytics/contracts";
import { signalEnabled, fixturePreviewAllowed } from "@/lib/signal/contracts";
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
