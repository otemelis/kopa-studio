import { dispatchCollection } from "../_dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(request: Request) {
  return dispatchCollection(request, "maintenance");
}
