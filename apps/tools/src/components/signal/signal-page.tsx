import { headers } from "next/headers";
import { RealProductWorkspace } from "@/components/product-analytics/workspace";
import {
  localSnapshotEnabled,
  localRequestAllowed,
} from "@/lib/product-analytics/contracts";
import { requireUser } from "@/lib/auth";
import {
  fixturePreviewAllowed,
  type SignalScreen,
} from "@/lib/signal/contracts";
import { SignalWorkspace } from "./workspace";
export async function SignalPage({
  screen,
  params,
}: {
  screen: SignalScreen;
  params: Record<string, string | string[] | undefined>;
}) {
  const sample = fixturePreviewAllowed(process.env, params.data === "sample");
  if (screen === "product" && !sample && localSnapshotEnabled(process.env)) {
    const h = await headers();
    if (localRequestAllowed(h.get("host"), h.get("origin")))
      return <RealProductWorkspace />;
  }
  const owner = sample ? { id: "preview", email: "" } : await requireUser();
  return <SignalWorkspace screen={screen} sample={sample} ownerId={owner.id} />;
}
