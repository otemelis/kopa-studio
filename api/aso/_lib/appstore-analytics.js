import { gunzipSync } from "node:zlib";
import {
  appStoreConnectJson,
  createAnalyticsProvisioningToken,
  hasAnalyticsProvisioningConfig,
} from "./appstore-connect.js";

const DISCOVERY_REPORT = "App Store Discovery and Engagement Standard";
export const DISCOVERY_PARSER_VERSION = "discovery-v2";
const REQUIRED_DISCOVERY_HEADERS = ["Date", "Event", "Page Type", "Source Type", "Territory", "Counts"];

export class DiscoveryReportParseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DiscoveryReportParseError";
    this.parserVersion = DISCOVERY_PARSER_VERSION;
    this.details = details;
  }
}

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

function parsedCount(value, { optional = false } = {}) {
  const normalized = clean(value).replace(/,/g, "");
  if (!normalized && optional) return { valid: true, value: 0 };
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0
    ? { valid: true, value: Math.round(parsed) }
    : { valid: false, value: 0 };
}

export function inspectDiscoveryReport(csv) {
  const rows = delimitedRows(csv);
  if (!rows.length) {
    throw new DiscoveryReportParseError("Apple returned an empty Discovery and Engagement report.", {
      headers: [],
      sourceRowCount: 0,
    });
  }
  const headers = rows[0].map((header) => clean(header).replace(/^\uFEFF/, ""));
  const missingHeaders = REQUIRED_DISCOVERY_HEADERS.filter((field) => !headers.includes(field));
  if (missingHeaders.length) {
    throw new DiscoveryReportParseError("Apple returned an unexpected Discovery and Engagement report format.", {
      headers,
      missingHeaders,
      sourceRowCount: Math.max(0, rows.length - 1),
    });
  }

  const parsedRows = [];
  const issues = [];
  rows.slice(1).forEach((values, index) => {
    const rawPayload = Object.fromEntries(headers.map((header, column) => [header, clean(values[column])]));
    const rowNumber = index + 2;
    const counts = parsedCount(rawPayload.Counts);
    const uniqueCounts = parsedCount(rawPayload["Unique Counts"], { optional: true });
    const rowIssues = [
      !/^\d{4}-\d{2}-\d{2}$/.test(rawPayload.Date) ? "invalid_date" : null,
      !rawPayload.Event ? "missing_event" : null,
      !rawPayload.Territory ? "missing_territory" : null,
      !counts.valid ? "invalid_counts" : null,
      !uniqueCounts.valid ? "invalid_unique_counts" : null,
    ].filter(Boolean);
    if (rowIssues.length) {
      issues.push({ rowNumber, codes: rowIssues });
      return;
    }
    parsedRows.push({
      date: rawPayload.Date,
      event: rawPayload.Event,
      pageType: rawPayload["Page Type"] || "No page",
      sourceType: rawPayload["Source Type"] || "Unavailable",
      country: rawPayload.Territory.toLowerCase(),
      count: counts.value,
      uniqueCount: uniqueCounts.value,
      rawPayload,
    });
  });

  if (!parsedRows.length && issues.length) {
    throw new DiscoveryReportParseError("Apple returned Discovery rows, but none passed validation.", {
      headers,
      sourceRowCount: rows.length - 1,
      rejectedRowCount: issues.length,
      issues,
    });
  }

  return {
    parserVersion: DISCOVERY_PARSER_VERSION,
    state: issues.length ? "partial" : parsedRows.length ? "success" : "zero",
    headers,
    sourceRowCount: Math.max(0, rows.length - 1),
    importedRowCount: parsedRows.length,
    rejectedRowCount: issues.length,
    issues,
    rows: parsedRows,
  };
}

export function parseDiscoveryReport(csv) {
  return inspectDiscoveryReport(csv).rows.map(({ rawPayload: _rawPayload, ...row }) => row);
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
  const files = [];
  for (const instance of recent) {
    const segments = (await appStoreConnectJson(`/v1/analyticsReportInstances/${encodeURIComponent(instance.id)}/segments?limit=200`)).data ?? [];
    for (const segment of segments) {
      files.push({
        text: await downloadSegment(segment.attributes?.url),
        segmentId: segment.id,
        instanceId: instance.id,
        processingDate: instance.attributes?.processingDate ?? null,
      });
    }
  }
  return files;
}

export async function syncDiscoveryAnalytics(db, apps) {
  const requests = await db.select("aso_analytics_report_requests", "select=*");
  const appById = new Map(apps.map((app) => [app.id, app]));
  const raw = new Map();
  const requestOutcomes = [];
  let segments = 0;
  let sourceRows = 0;
  let rejectedRows = 0;
  for (const request of requests) {
    const app = appById.get(request.app_id);
    if (!app) continue;
    try {
      const files = await discoverySegments(request.appstore_connect_request_id);
      segments += files.length;
      const headers = new Set();
      const issues = [];
      const dates = [];
      let requestSourceRows = 0;
      let requestImportedRows = 0;
      let requestRejectedRows = 0;
      for (const file of files) {
        const result = inspectDiscoveryReport(file.text);
        result.headers.forEach((header) => headers.add(header));
        requestSourceRows += result.sourceRowCount;
        requestImportedRows += result.importedRowCount;
        requestRejectedRows += result.rejectedRowCount;
        issues.push(...result.issues.map((issue) => ({ segmentId: file.segmentId, ...issue })));
        for (const row of result.rows) {
          dates.push(row.date);
          const key = `${app.id}:${row.date}:${row.country}:${row.event}:${row.pageType}:${row.sourceType}`;
          const existing = raw.get(key);
          if (existing) {
            existing.count += row.count;
            existing.uniqueCount += row.uniqueCount;
            existing.rawPayloads.push({
              segmentId: file.segmentId,
              instanceId: file.instanceId,
              processingDate: file.processingDate,
              row: row.rawPayload,
            });
          } else {
            raw.set(key, {
              app,
              ...row,
              rawPayloads: [{
                segmentId: file.segmentId,
                instanceId: file.instanceId,
                processingDate: file.processingDate,
                row: row.rawPayload,
              }],
            });
          }
        }
      }
      sourceRows += requestSourceRows;
      rejectedRows += requestRejectedRows;
      const state = requestRejectedRows ? "partial" : requestImportedRows ? "success" : "zero";
      requestOutcomes.push({
        request,
        state,
        files: files.length,
        sourceRows: requestSourceRows,
        importedRows: requestImportedRows,
        rejectedRows: requestRejectedRows,
        headers: [...headers],
        issues: issues.slice(0, 50),
        evidenceStart: dates.length ? [...dates].sort()[0] : null,
        evidenceEnd: dates.length ? [...dates].sort().at(-1) : null,
      });
    } catch (error) {
      const details = error instanceof DiscoveryReportParseError ? error.details : {};
      await db.update(
        "aso_analytics_report_requests",
        {
          status: "error",
          last_checked_at: new Date().toISOString(),
          last_error: error instanceof Error ? error.message : String(error),
          last_result_state: "error",
          parser_version: DISCOVERY_PARSER_VERSION,
          last_segment_count: 0,
          last_source_row_count: Number(details.sourceRowCount ?? 0),
          last_imported_row_count: 0,
          last_rejected_row_count: Number(details.rejectedRowCount ?? 0),
          last_report_headers: details.headers ?? [],
          last_issues: details.issues ?? [],
          last_evidence_start: null,
          last_evidence_end: null,
          updated_at: new Date().toISOString(),
        },
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
    parser_version: DISCOVERY_PARSER_VERSION,
    raw_payload: { sourceRows: row.rawPayloads },
  }));
  await db.upsert("aso_storefront_metrics", rawRows, "app_id,date,country,event,page_type,source_type,source");

  const daily = new Map();
  for (const row of raw.values()) {
    const key = `${row.app.id}:${row.date}:${row.country}`;
    const aggregate = daily.get(key) ?? { app: row.app, date: row.date, country: row.country, impressions: 0, pageViews: 0, importKeys: [] };
    if (row.event.toLowerCase() === "impression") aggregate.impressions += row.count;
    if (row.event.toLowerCase() === "page view" && row.pageType.toLowerCase() === "product page") aggregate.pageViews += row.count;
    aggregate.importKeys.push(`appstore_connect_discovery:${row.app.id}:${row.date}:${row.country}:${row.event}:${row.pageType}:${row.sourceType}`);
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
    parser_version: DISCOVERY_PARSER_VERSION,
    raw_payload: { derivedFromStorefrontImportKeys: row.importKeys },
  }));
  await db.upsert("aso_daily_metrics", dailyRows, "app_id,date,country,source");
  const now = new Date().toISOString();
  for (const outcome of requestOutcomes) {
    const detail = outcome.state === "success"
      ? `Imported ${outcome.importedRows} source row(s) from ${outcome.files} segment(s).`
      : outcome.state === "partial"
        ? `Imported ${outcome.importedRows} source row(s); rejected ${outcome.rejectedRows} invalid row(s).`
        : outcome.files
          ? "Apple generated a valid report with zero data rows."
          : "Apple has not generated a Discovery and Engagement segment yet.";
    await db.update(
      "aso_analytics_report_requests",
      {
        status: outcome.files ? "active" : "pending",
        last_checked_at: now,
        last_error: null,
        last_result_state: outcome.state,
        last_result_detail: detail,
        parser_version: DISCOVERY_PARSER_VERSION,
        last_segment_count: outcome.files,
        last_source_row_count: outcome.sourceRows,
        last_imported_row_count: outcome.importedRows,
        last_rejected_row_count: outcome.rejectedRows,
        last_report_headers: outcome.headers,
        last_issues: outcome.issues,
        last_evidence_start: outcome.evidenceStart,
        last_evidence_end: outcome.evidenceEnd,
        updated_at: now,
      },
      `id=eq.${outcome.request.id}`,
    );
  }
  const state = requestOutcomes.some((outcome) => outcome.state === "partial")
    ? "partial"
    : requestOutcomes.some((outcome) => outcome.state === "success")
      ? "success"
      : "zero";
  return { state, parserVersion: DISCOVERY_PARSER_VERSION, segments, sourceRows, rawRows: rawRows.length, dailyRows: dailyRows.length, rejectedRows };
}
