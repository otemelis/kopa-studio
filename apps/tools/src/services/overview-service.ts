import { getOverview, listRecentRuns } from "@/repositories/overview-repository";

export async function loadOverview() {
  const [metrics, recentRuns] = await Promise.all([getOverview(), listRecentRuns()]);
  return { metrics, recentRuns };
}
