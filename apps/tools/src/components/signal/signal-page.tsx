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
  const owner = sample ? { id: "preview", email: "" } : await requireUser();
  return <SignalWorkspace screen={screen} sample={sample} ownerId={owner.id} />;
}
