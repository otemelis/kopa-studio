import { gunzipSync } from "node:zlib";
import { createAppStoreConnectToken } from "./appstore-connect.js";

const API_ROOT = "https://api.appstoreconnect.apple.com";

function requiredVendorNumber() {
  const value = process.env.APP_STORE_CONNECT_VENDOR_NUMBER?.trim();
  if (!value) throw new Error("Missing APP_STORE_CONNECT_VENDOR_NUMBER in Vercel environment variables.");
  return value;
}

function apiError(status, body) {
  const first = body?.errors?.[0];
  const error = new Error(`App Store Connect ${status}: ${first?.title || first?.detail || "Sales report request failed."}`);
  error.status = status;
  return error;
}

export function hasSalesReportsConfig() {
  return Boolean(process.env.APP_STORE_CONNECT_VENDOR_NUMBER);
}

/** Download Apple's most recently available daily Summary Sales report. */
export async function downloadDailySalesSummary() {
  const params = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportSubType]": "SUMMARY",
    "filter[reportType]": "SALES",
    "filter[vendorNumber]": requiredVendorNumber(),
    "filter[version]": "1_0",
  });
  const response = await fetch(`${API_ROOT}/v1/salesReports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${createAppStoreConnectToken()}`, Accept: "application/a-gzip" },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw apiError(response.status, body);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  // Apple normally returns an application/a-gzip body. Some fetch runtimes
  // transparently decode a Content-Encoding gzip response, so support both.
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
}

function clean(value) {
  return String(value ?? "").trim();
}

function number(value) {
  const parsed = Number(clean(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Apple's Summary Sales report is tab-separated. This parser intentionally
 * keeps only app-level rows and the fields this console can represent.
 */
export function parseDailySalesSummary(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].replace(/^\uFEFF/, "").split("\t").map(clean);
  const required = ["Apple Identifier", "Units", "End Date", "Country Code"];
  if (required.some((name) => !headers.includes(name))) throw new Error("Apple returned an unexpected Summary Sales report format.");

  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    const row = Object.fromEntries(headers.map((header, index) => [header, clean(values[index])]));
    return {
      storeAppId: row["Apple Identifier"],
      date: row["End Date"],
      country: row["Country Code"].toLowerCase(),
      downloads: number(row.Units),
      proceeds: number(row["Developer Proceeds"]),
      proceedsCurrency: row["Currency of Proceeds"] || null,
    };
  });
}

export function salesSyncMessage(result) {
  if (result.noData || result.reportRows === 0) return "Apple returned no Summary Sales rows for the latest available day.";
  if (result.imported === 0) return `Apple returned ${result.reportRows} sales row(s), but none match Kopa's tracked apps.`;
  return `Sales sync imported ${result.imported} country row(s) for ${result.dates.join(", ")}.`;
}

export async function syncDailySalesMetrics(db, ownedApps) {
  let report;
  try {
    report = await downloadDailySalesSummary();
  } catch (error) {
    // Apple doesn't publish a Summary Sales report until at least one unit
    // exists. An absent report is not a broken integration.
    if (error?.status === 404) return { imported: 0, reportRows: 0, unmatchedRows: 0, dates: [], noData: true };
    throw error;
  }
  const appByStoreId = new Map(ownedApps.map((app) => [String(app.store_app_id), app]));
  const aggregates = new Map();
  let unmatchedRows = 0;

  const reportRows = parseDailySalesSummary(report);
  for (const row of reportRows) {
    const app = appByStoreId.get(row.storeAppId);
    if (!app || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.country) {
      unmatchedRows++;
      continue;
    }
    const key = `${app.id}:${row.date}:${row.country}`;
    const existing = aggregates.get(key) ?? { app, date: row.date, country: row.country, downloads: 0, proceeds: 0, currencies: new Set() };
    existing.downloads += row.downloads;
    existing.proceeds += row.proceeds;
    if (row.proceedsCurrency) existing.currencies.add(row.proceedsCurrency);
    aggregates.set(key, existing);
  }

  const rows = [...aggregates.values()].map((entry) => ({
    app_id: entry.app.id,
    date: entry.date,
    country: entry.country,
    impressions: null,
    page_views: null,
    downloads: Math.round(entry.downloads),
    proceeds: entry.currencies.size <= 1 ? entry.proceeds : null,
    proceeds_currency: entry.currencies.size === 1 ? [...entry.currencies][0] : null,
    import_key: `appstore_connect_sales:${entry.app.id}:${entry.date}:${entry.country}`,
    source: "appstore_connect_sales",
  }));

  await db.upsert("aso_daily_metrics", rows, "app_id,date,country,source");
  return { imported: rows.length, reportRows: reportRows.length, unmatchedRows, dates: [...new Set(rows.map((row) => row.date))] };
}
