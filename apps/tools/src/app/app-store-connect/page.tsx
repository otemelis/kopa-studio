import LegacyScreen from "./legacy-screen";
import { SignalPage } from "@/components/signal/signal-page";
import { signalEnabled } from "@/lib/signal/contracts";
export const dynamic = "force-dynamic";
type Params = Promise<Record<string, string | string[] | undefined>>;
export default async function Page({ searchParams }: { searchParams: Params }) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  if (signalEnabled(process.env) && params.view !== "legacy")
    return <SignalPage screen="sources" params={params} />;
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
