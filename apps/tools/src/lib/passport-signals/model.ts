export type PassportCount = {
  day: string;
  buildChannel: "appstore" | "testflight";
  appVersion: string;
  event: string;
  dims: string;
  count: number;
  updatedAt: string;
};

export const passportEvents = [
  ["app_opened", "App opens"],
  ["onboarding_presented", "Onboarding presented"],
  ["onboarding_completed", "Onboarding completed"],
  ["stamp_editor_opened", "Stamp editor opened"],
  ["stamp_created", "Stamps created"],
  ["first_stamp_completed", "First-stamp completions"],
  ["flight_logged", "Flights logged"],
  ["parks_purchase_started", "Parks purchase started"],
  ["parks_purchase_completed", "Parks client purchase completed"],
] as const;

export function summarizePassportCounts(rows: PassportCount[]) {
  const total = (event: string) => rows.filter((row) => row.event === event)
    .reduce((sum, row) => sum + row.count, 0);
  const versions = [...new Set(rows.map((row) => row.appVersion))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const days = [...new Set(rows.map((row) => row.day))].sort();
  const latestUpload = rows.reduce<string | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null);
  return {
    versions,
    latestUpload,
    total,
    byDay: days.map((day) => ({
      day,
      opens: rows.filter((row) => row.day === day && row.event === "app_opened").reduce((sum, row) => sum + row.count, 0),
      firstStamps: rows.filter((row) => row.day === day && row.event === "first_stamp_completed").reduce((sum, row) => sum + row.count, 0),
      allEvents: rows.filter((row) => row.day === day).reduce((sum, row) => sum + row.count, 0),
    })),
    byVersion: versions.map((version) => ({
      version,
      events: rows.filter((row) => row.appVersion === version).reduce((sum, row) => sum + row.count, 0),
      opens: rows.filter((row) => row.appVersion === version && row.event === "app_opened").reduce((sum, row) => sum + row.count, 0),
      firstStamps: rows.filter((row) => row.appVersion === version && row.event === "first_stamp_completed").reduce((sum, row) => sum + row.count, 0),
    })),
  };
}

export function parseVercelCount(value: unknown): { visitors: number; pageviews: number } {
  if (!value || typeof value !== "object" || !("data" in value)) throw new Error("Vercel Analytics count response missing data");
  const data = value.data;
  if (!data || typeof data !== "object" || !("visitors" in data) || !("pageviews" in data) ||
      !Number.isSafeInteger(data.visitors) || !Number.isSafeInteger(data.pageviews) ||
      (data.visitors as number) < 0 || (data.pageviews as number) < 0)
    throw new Error("Vercel Analytics count response invalid");
  return { visitors: data.visitors as number, pageviews: data.pageviews as number };
}

export function parseVercelRows(value: unknown, dimension: "day" | "requestPath" | "referrerHostname") {
  if (!value || typeof value !== "object" || !("data" in value) || !Array.isArray(value.data))
    throw new Error("Vercel Analytics aggregate response invalid");
  return value.data.map((row: unknown) => {
    if (!row || typeof row !== "object" || !("visitors" in row) || !("pageviews" in row) ||
        !Number.isSafeInteger(row.visitors) || !Number.isSafeInteger(row.pageviews) ||
        (row.visitors as number) < 0 || (row.pageviews as number) < 0)
      throw new Error("Vercel Analytics aggregate row invalid");
    const record = row as Record<string, unknown>;
    const raw = dimension === "day" ? record.timestamp : record[dimension];
    if (typeof raw !== "string") throw new Error("Vercel Analytics aggregate dimension missing");
    return { label: dimension === "day" ? raw.slice(0, 10) : raw || "(direct / unknown)", visitors: row.visitors as number, pageviews: row.pageviews as number };
  });
}
