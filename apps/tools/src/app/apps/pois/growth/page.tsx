import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function LegacyPoisGrowthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["days", "country", "channel", "version"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  redirect(`/pois-signals${query.size ? `?${query}` : ""}`);
}
