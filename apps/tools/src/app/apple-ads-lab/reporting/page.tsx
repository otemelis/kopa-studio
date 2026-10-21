import LegacyScreen from "./legacy-screen";
import { SignalPage } from "@/components/signal/signal-page";
import { signalEnabled } from "@/lib/signal/contracts";
export const dynamic = "force-dynamic";
type Params = Promise<Record<string, string | string[] | undefined>>;
export default async function Page({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  if (signalEnabled(process.env) && params.view !== "legacy")
    return <SignalPage screen="ads" params={params} />;
  return <LegacyScreen />;
}
