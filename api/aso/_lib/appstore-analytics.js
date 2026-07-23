import { gunzipSync } from "node:zlib";
import {
  appStoreConnectJson,
  createAnalyticsProvisioningToken,
  hasAnalyticsProvisioningConfig,
} from "./appstore-connect.js";

const DISCOVERY_REPORT = "App Store Discovery and Engagement Standard";

export function hasDiscoveryAnalyticsProvisioning() {
  return hasAnalyticsProvisioningConfig();
}

async function provisionRequest(appstoreConnectId) {
  return appStoreConnectJson("/v1/analyticsReportRequests", {
    method: "POST",
    token: createAnalyticsProvisioningToken(),
    body: {
      data: {
        type: "analyticsReportRequests",
        attributes: { accessType: "ONGOING" },
        relationships: { app: { data: { type: "apps", id: appstoreConnectId } } },
      },
    },
  });
}

async function remoteRequests(appstoreConnectId) {
  const body = await appStoreConnectJson(`/v1/apps/${encodeURIComponent(appstoreConnectId)}/analyticsReportRequests?limit=200`);
  return body?.data ?? [];
}

export async function provisionDiscoveryRequests(db, apps) {
  if (!hasDiscoveryAnalyticsProvisioning()) throw new Error("Temporary App Store Connect Admin setup key is not configured in Vercel.");
  let created = 0;
  let existing = 0;
  for (const app of apps.filter((item) => item.appstore_connect_id)) {
    const [stored] = await db.select("aso_analytics_report_requests", `app_id=eq.${app.id}&select=*`);
    if (stored) {
      existing++;
      continue;
    }
    const current = await remoteRequests(app.appstore_connect_id);
    const request = current[0] ?? (await provisionRequest(app.appstore_connect_id)).data;
    await db.upsert(
      "aso_analytics_report_requests",
      [{ app_id: app.id, appstore_connect_request_id: request.id, access_type: request.attributes?.accessType ?? "ONGOING", status: "requested", last_checked_at: new Date().toISOString(), last_error: null }],
      "app_id",
    );
    if (current.length) existing++;
    else created++;
  }
  return { created, existing, tracked: apps.filter((item) => item.appstore_connect_id).length };
}

function detectDelimiter(text) {
  const firstLine = String(text ?? "").split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

function delimitedRows(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((field) => field.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value);
  if (row.some((field) => field.trim())) rows.push(row);
  return rows;
}

function clean(value) {
  return String(value ?? "").trim();
}

function count(value) {
  const parsed = Number(clean(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function parseDiscoveryReport(csv) {
  const rows = delimitedRows(csv);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => clean(header).replace(/^\uFEFF/, ""));
  const required = ["Date", "Event", "Page Type", "Source Type", "Territory", "Counts"];
  if (required.some((field) => !headers.includes(field))) throw new Error("Apple returned an unexpected Discovery and Engagement report format.");
  return rows.slice(1).map((values) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, clean(values[index])]));
    return {
      date: row.Date,
      event: row.Event,
      pageType: row["Page Type"] || "No page",
      sourceType: row["Source Type"] || "Unavailable",
      country: row.Territory.toLowerCase(),
      count: count(row.Counts),
      uniqueCount: count(row["Unique Counts"]),
    };
  });
}

async function downloadSegment(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Analytics segment download failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
}

async function discoverySegments(requestId) {
  const reports = (await appStoreConnectJson(`/v1/analyticsReportRequests/${encodeURIComponent(requestId)}/reports?limit=50`)).data ?? [];
  const report = reports.find((item) => item.attributes?.name === DISCOVERY_REPORT);
  if (!report) return [];
  const instances = (await appStoreConnectJson(`/v1/analyticsReports/${encodeURIComponent(report.id)}/instances?filter[granularity]=DAILY&limit=200`)).data ?? [];
  const recent = [...instances]
    .sort((a, b) => String(b.attributes?.processingDate ?? "").localeCompare(String(a.attributes?.processingDate ?? "")))
    .slice(0, 4);
  const csv = [];
  for (const instance of recent) {
    const segments = (await appStoreConnectJson(`/v1/analyticsReportInstances/${encodeURIComponent(instance.id)}/segments?limit=200`)).data ?? [];
    for (const segment of segments) csv.push(await downloadSegment(segment.attributes?.url));
  }
  return csv;
}

export async function syncDiscoveryAnalytics(db, apps) {
  const requests = await db.select("aso_analytics_report_requests", "select=*");
  const appById = new Map(apps.map((app) => [app.id, app]));
  const raw = new Map();
  let segments = 0;
  for (const request of requests) {
    const app = appById.get(request.app_id);
    if (!app) continue;
    try {
      const files = await discoverySegments(request.appstore_connect_request_id);
      segments += files.length;
      for (const file of files) {
        for (const row of parseDiscoveryReport(file)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.country) continue;
          const key = `${app.id}:${row.date}:${row.country}:${row.event}:${row.pageType}:${row.sourceType}`;
          const existing = raw.get(key);
          if (existing) {
            existing.count += row.count;
            existing.uniqueCount += row.uniqueCount;
          } else {
            raw.set(key, { app, ...row });
          }
        }
      }
      await db.update(
        "aso_analytics_report_requests",
        { status: files.length ? "active" : "pending", last_checked_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() },
        `id=eq.${request.id}`,
      );
    } catch (error) {
      await db.update(
        "aso_analytics_report_requests",
        { status: "error", last_checked_at: new Date().toISOString(), last_error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() },
        `id=eq.${request.id}`,
      ).catch(() => undefined);
      throw error;
    }
  }

  const rawRows = [...raw.values()].map((row) => ({
    app_id: row.app.id,
    date: row.date,
    country: row.country,
    event: row.event,
    page_type: row.pageType,
    source_type: row.sourceType,
    count: row.count,
    unique_count: row.uniqueCount,
    import_key: `appstore_connect_discovery:${row.app.id}:${row.date}:${row.country}:${row.event}:${row.pageType}:${row.sourceType}`,
    source: "appstore_connect_discovery",
  }));
  await db.upsert("aso_storefront_metrics", rawRows, "app_id,date,country,event,page_type,source_type,source");

  const daily = new Map();
  for (const row of raw.values()) {
    const key = `${row.app.id}:${row.date}:${row.country}`;
    const aggregate = daily.get(key) ?? { app: row.app, date: row.date, country: row.country, impressions: 0, pageViews: 0 };
    if (row.event.toLowerCase() === "impression") aggregate.impressions += row.count;
    if (row.event.toLowerCase() === "page view" && row.pageType.toLowerCase() === "product page") aggregate.pageViews += row.count;
    daily.set(key, aggregate);
  }
  const dailyRows = [...daily.values()].map((row) => ({
    app_id: row.app.id,
    date: row.date,
    country: row.country,
    impressions: row.impressions,
    page_views: row.pageViews,
    downloads: null,
    proceeds: null,
    proceeds_currency: null,
    import_key: `appstore_connect_discovery:${row.app.id}:${row.date}:${row.country}`,
    source: "appstore_connect_discovery",
  }));
  await db.upsert("aso_daily_metrics", dailyRows, "app_id,date,country,source");
  return { segments, rawRows: rawRows.length, dailyRows: dailyRows.length };
}
