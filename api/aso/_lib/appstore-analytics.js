import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  appStoreConnectJson,
  createAnalyticsProvisioningToken,
  hasAnalyticsProvisioningConfig,
} from "./appstore-connect.js";

const DISCOVERY_REPORT = "App Store Discovery and Engagement Standard";
const DOWNLOADS_REPORT = "App Downloads Standard";
const POIS_APPLE_ID = "6820665225";
const POIS_APPROVED_REQUEST_ID = "0a5174c1-f952-401f-abea-3f9fd6487a36";
const APPROVED_REQUESTS = new Map([
  [POIS_APPLE_ID, POIS_APPROVED_REQUEST_ID],
  ["6822753543", "1a1002c3-3a07-4d10-afca-6352b89790d5"],
]);
const MAX_REPORT_PAGES = 10;
const MAX_HISTORY_INSTANCES = 35;
export function approvedRequestForApp(app) {
  const appleId = String(app?.store_app_id ?? "");
  return String(app?.appstore_connect_id ?? "") === appleId ? APPROVED_REQUESTS.get(appleId) ?? null : null;
}
export function validateHistoryWindow(start, end) {
  if (start == null && end == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? "")) throw new Error("Analytics backfill requires an explicit ISO start and end date.");
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last - first > 34 * 86400000) throw new Error("Analytics backfill window must be 1–35 reporting days.");
  return { start, end };
}

export function buildAnalyticsPartitions(storefrontRows, dailyRows) {
  const byKey = new Map();
  for (const row of [...storefrontRows, ...dailyRows]) {
    if (!row.raw_payload?.sourceRows?.length && !row.raw_payload?.derivedFromStorefrontImportKeys?.length) throw new Error("Apple partition row lacks provenance.");
    const partitionSource = row.source === "appstore_connect_first_time_downloads" ? "appstore_connect_downloads" : row.source;
    const key = `${row.app_id}:${row.date}:${partitionSource}`;
    const part = byKey.get(key) ?? { app_id: row.app_id, date: row.date, source: partitionSource, storefront_rows: [], daily_rows: [], processing_date: null };
    if (row.event) part.storefront_rows.push(row);
    else part.daily_rows.push(row);
    const dates = (row.raw_payload.sourceRows ?? []).map((source) => String(source.processingDate ?? ""));
    for (const date of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Apple processing date is missing or invalid.");
      if (part.processing_date && part.processing_date !== date) throw new Error("Mixed Apple processing revisions in one partition.");
      part.processing_date = date;
    }
    byKey.set(key, part);
  }
  return [...byKey.values()].sort((a, b) => `${a.app_id}:${a.date}:${a.source}`.localeCompare(`${b.app_id}:${b.date}:${b.source}`)).map((part) => {
    if (!part.processing_date) throw new Error("Apple partition has no processing revision.");
    part.storefront_rows.sort((a, b) => a.import_key.localeCompare(b.import_key));
    part.daily_rows.sort((a, b) => a.import_key.localeCompare(b.import_key));
    part.payload_hash = createHash("sha256").update(JSON.stringify(part)).digest("hex");
    return part;
  });
}
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
  return paginatedAppleRows(`/v1/apps/${encodeURIComponent(appstoreConnectId)}/analyticsReportRequests?limit=200`);
}

/** Follow Apple's links.next without accepting an off-host or unbounded page chain. */
export async function paginatedAppleRows(path, get = appStoreConnectJson, maxPages = MAX_REPORT_PAGES) {
  const rows = [];
  const seen = new Set();
  for (let page = 0; path; page++) {
    if (page >= maxPages || seen.has(path)) throw new Error("Apple report pagination exceeded its safe bound.");
    seen.add(path);
    const body = await get(path);
    rows.push(...(body?.data ?? []));
    const next = body?.links?.next;
    if (!next) break;
    const url = new URL(next, "https://api.appstoreconnect.apple.com");
    if (url.origin !== "https://api.appstoreconnect.apple.com" || !url.pathname.startsWith("/v1/")) throw new Error("Unexpected Apple report pagination host or path.");
    path = `${url.pathname}${url.search}`;
  }
  return rows;
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
  if (!url) throw new Error("Analytics segment URL is missing.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !["asp-us-west-2.s3.us-west-2.amazonaws.com"].includes(parsed.hostname)) throw new Error("Unexpected Analytics segment host.");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Analytics segment download failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes;
}

export function latestProcessingRows(files, parse, expectedAppleId) {
  const latestByDate = new Map();
  const parsed = files.map((file) => {
    const result = parse(file.text);
    if (result.rejectedRowCount) throw new DiscoveryReportParseError("Apple report contains rejected rows; import aborted.", result);
    for (const row of result.rows) {
      if (expectedAppleId && row.rawPayload["App Apple Identifier"] !== expectedAppleId) throw new DiscoveryReportParseError("Apple report app ID did not match the selected app.");
      const prior = latestByDate.get(row.date);
      if (!prior || String(file.processingDate) > prior) latestByDate.set(row.date, String(file.processingDate));
    }
    return { file, result };
  });
  return parsed.flatMap(({ file, result }) => result.rows.filter((row) => String(file.processingDate) === latestByDate.get(row.date)).map((row) => ({ ...row, file })));
}

export function inspectDownloadsReport(csv) {
  const rows = delimitedRows(csv);
  const headers = (rows[0] ?? []).map((header) => clean(header).replace(/^\uFEFF/, ""));
  const required = ["Date", "App Apple Identifier", "Download Type", "Source Type", "Territory", "Counts"];
  if (required.some((header) => !headers.includes(header))) throw new DiscoveryReportParseError("Apple returned an unexpected Downloads report format.", { headers });
  const parsed = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, clean(values[index])])));
  const invalid = parsed.filter((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.Date) || !row.Territory || !parsedCount(row.Counts).valid);
  if (invalid.length) throw new DiscoveryReportParseError("Apple Downloads report contains invalid rows.", { rejectedRowCount: invalid.length });
  return { rejectedRowCount: 0, rows: parsed.filter((row) => row["Download Type"] === "First-time download").map((row) => ({ date: row.Date, country: row.Territory.toLowerCase(), sourceType: row["Source Type"] || "Unavailable", count: parsedCount(row.Counts).value, rawPayload: row })) };
}

async function reportSegments(requestId, reportName, maxInstances = 4) {
  const reports = await paginatedAppleRows(`/v1/analyticsReportRequests/${encodeURIComponent(requestId)}/reports?limit=50`);
  const report = reports.find((item) => item.attributes?.name === reportName);
  if (!report) return [];
  const instances = await paginatedAppleRows(`/v1/analyticsReports/${encodeURIComponent(report.id)}/instances?filter[granularity]=DAILY&limit=200`);
  const recent = [...instances]
    .sort((a, b) => String(b.attributes?.processingDate ?? "").localeCompare(String(a.attributes?.processingDate ?? "")))
    .slice(0, maxInstances);
  const files = [];
  for (const instance of recent) {
    const segments = await paginatedAppleRows(`/v1/analyticsReportInstances/${encodeURIComponent(instance.id)}/segments?limit=200`);
    for (const segment of segments) {
      const bytes = await downloadSegment(segment.attributes?.url);
      if (bytes.length !== Number(segment.attributes?.sizeInBytes) || createHash("md5").update(bytes).digest("hex") !== segment.attributes?.checksum) throw new Error("Apple Analytics segment size or checksum mismatch.");
      files.push({
        text: (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8"),
        segmentId: segment.id,
        instanceId: instance.id,
        processingDate: instance.attributes?.processingDate ?? null,
        reportId: report.id,
        requestId,
        segmentChecksum: segment.attributes?.checksum,
      });
    }
  }
  return files;
}

export async function syncDiscoveryAnalytics(db, apps, { dryRun = false, maxInstances = MAX_HISTORY_INSTANCES, historyStart = null, historyEnd = null } = {}) {
  if (!Number.isInteger(maxInstances) || maxInstances < 1 || maxInstances > MAX_HISTORY_INSTANCES) throw new Error("Analytics history bound must be 1–35 instances.");
  const window = validateHistoryWindow(historyStart, historyEnd);
  const inWindow = (date) => !window || (date >= window.start && date <= window.end);
  const requests = await db.select("aso_analytics_report_requests", "select=*");
  for (const app of apps) {
    const appleId = String(app.store_app_id ?? "");
    const approvedId = approvedRequestForApp(app);
    if (!approvedId || requests.some((request) => request.app_id === app.id)) continue;
    const remote = await remoteRequests(appleId);
    const approved = remote.find((request) => request.id === approvedId && request.attributes?.accessType === "ONGOING");
    if (!approved) throw new Error(`Approved Analytics request is not available for app ${appleId}; no data imported.`);
    const mapping = { app_id: app.id, appstore_connect_request_id: approved.id, access_type: "ONGOING", status: "requested", last_checked_at: new Date().toISOString(), last_error: null };
    if (dryRun) requests.push({ ...mapping, id: `dry-run:${app.id}` });
    else {
      await db.upsert("aso_analytics_report_requests", [mapping], "app_id");
      requests.push(...await db.select("aso_analytics_report_requests", `app_id=eq.${app.id}&select=*`));
    }
  }
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
      const files = await reportSegments(request.appstore_connect_request_id, DISCOVERY_REPORT, maxInstances);
      segments += files.length;
      const headers = new Set();
      const issues = [];
      const dates = [];
      let requestSourceRows = 0;
      let requestImportedRows = 0;
      let requestRejectedRows = 0;
      const selected = latestProcessingRows(files, inspectDiscoveryReport, String(app.store_app_id)).filter((row) => inWindow(row.date));
      for (const file of files) {
        const result = inspectDiscoveryReport(file.text);
        result.headers.forEach((header) => headers.add(header));
        requestSourceRows += result.sourceRowCount;
        requestImportedRows += selected.filter((item) => item.file === file).length;
        requestRejectedRows += result.rejectedRowCount;
        issues.push(...result.issues.map((issue) => ({ segmentId: file.segmentId, ...issue })));
        for (const { file: selectedFile, ...row } of selected.filter((item) => item.file === file)) {
          dates.push(row.date);
          const key = `${app.id}:${row.date}:${row.country}:${row.event}:${row.pageType}:${row.sourceType}`;
          const existing = raw.get(key);
          if (existing) {
            existing.count += row.count;
            existing.uniqueCount += row.uniqueCount;
            existing.rawPayloads.push({
              segmentId: selectedFile.segmentId,
              instanceId: file.instanceId,
              processingDate: file.processingDate,
              reportId: file.reportId,
              requestId: file.requestId,
              segmentChecksum: file.segmentChecksum,
              row: row.rawPayload,
            });
          } else {
            raw.set(key, {
              app,
              ...row,
              rawPayloads: [{
                segmentId: selectedFile.segmentId,
                instanceId: file.instanceId,
                processingDate: file.processingDate,
                reportId: file.reportId,
                requestId: file.requestId,
                segmentChecksum: file.segmentChecksum,
                row: row.rawPayload,
              }],
            });
          }
        }
      }
      sourceRows += requestSourceRows;
      rejectedRows += requestRejectedRows;
      const state = !files.length ? "pending" : requestRejectedRows ? "partial" : requestImportedRows ? "success" : "zero";
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
      if (!dryRun) await db.update(
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

  const downloadDaily = new Map();
  for (const { request } of requestOutcomes) {
    const app = appById.get(request.app_id);
    if (!app?.store_app_id) continue;
    const files = await reportSegments(request.appstore_connect_request_id, DOWNLOADS_REPORT, maxInstances);
    const selected = latestProcessingRows(files, inspectDownloadsReport, String(app.store_app_id)).filter((row) => inWindow(row.date));
    for (const row of selected) {
      const key = `${app.id}:${row.date}:${row.country}`;
      const entry = downloadDaily.get(key) ?? { app, date: row.date, country: row.country, downloads: 0, sourceRows: [] };
      entry.downloads += row.count;
      entry.sourceRows.push({ segmentId: row.file.segmentId, instanceId: row.file.instanceId, processingDate: row.file.processingDate, reportId: row.file.reportId, requestId: row.file.requestId, segmentChecksum: row.file.segmentChecksum, row: row.rawPayload });
      downloadDaily.set(key, entry);
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
  const downloadSourceRows = [...downloadDaily.values()].flatMap((entry) => {
    const bySource = new Map();
    for (const item of entry.sourceRows) {
      const source = item.row["Source Type"] || "Unavailable";
      const bucket = bySource.get(source) ?? { count: 0, rows: [] };
      bucket.count += Number(item.row.Counts);
      bucket.rows.push(item);
      bySource.set(source, bucket);
    }
    return [...bySource].map(([source, bucket]) => ({
      app_id: entry.app.id, date: entry.date, country: entry.country,
      event: "First-time download", page_type: "No page", source_type: source,
      count: bucket.count, unique_count: null,
      import_key: `appstore_connect_downloads:${entry.app.id}:${entry.date}:${entry.country}:${source}`,
      source: "appstore_connect_downloads", parser_version: DISCOVERY_PARSER_VERSION,
      raw_payload: { sourceRows: bucket.rows },
    }));
  });

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
  const downloadDailyRows = [...downloadDaily.values()].map((row) => ({
    app_id: row.app.id,
    date: row.date,
    country: row.country,
    impressions: null,
    page_views: null,
    downloads: row.downloads,
    proceeds: null,
    proceeds_currency: null,
    import_key: `appstore_connect_first_time_downloads:${row.app.id}:${row.date}:${row.country}`,
    source: "appstore_connect_first_time_downloads",
    parser_version: DISCOVERY_PARSER_VERSION,
    raw_payload: { definition: "App Downloads Standard; Download Type=First-time download; UTC Analytics day", sourceRows: row.sourceRows },
  }));
  const partitions = buildAnalyticsPartitions([...rawRows, ...downloadSourceRows], [...dailyRows, ...downloadDailyRows]);
  if (rejectedRows && !dryRun) throw new Error("Apple Discovery report contains rejected rows; refusing partial partition replacement.");
  if (!dryRun) for (const partition of partitions) await db.rpc("aso_replace_analytics_partition", { p: partition });
  const now = new Date().toISOString();
  for (const outcome of requestOutcomes) {
    const detail = outcome.state === "success"
      ? `Imported ${outcome.importedRows} source row(s) from ${outcome.files} segment(s).`
      : outcome.state === "partial"
        ? `Imported ${outcome.importedRows} source row(s); rejected ${outcome.rejectedRows} invalid row(s).`
        : outcome.files
          ? "Apple generated a valid report with zero data rows."
          : "Apple has not generated a Discovery and Engagement segment yet.";
    if (!dryRun) await db.update(
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
  const state = requestOutcomes.some((outcome) => outcome.state === "partial" || outcome.state === "error" || (outcome.state === "pending" && requestOutcomes.some((other) => other.state === "success")))
    ? "partial"
    : requestOutcomes.some((outcome) => outcome.state === "success")
      ? "success"
      : requestOutcomes.length === 0 || requestOutcomes.some((outcome) => outcome.state === "pending") ? "pending" : "zero";
  return { state, dryRun, parserVersion: DISCOVERY_PARSER_VERSION, segments, sourceRows, rawRows: rawRows.length, downloadSourceRows: downloadSourceRows.length, dailyRows: dailyRows.length, rejectedRows, partitions: dryRun ? partitions : partitions.map(({ app_id, date, source, processing_date, payload_hash, storefront_rows, daily_rows }) => ({ app_id, date, source, processing_date, payload_hash, storefrontRows: storefront_rows.length, dailyRows: daily_rows.length })), requests: requestOutcomes.map((outcome) => ({ appId: outcome.request.app_id, state: outcome.state, evidenceStart: outcome.evidenceStart, evidenceEnd: outcome.evidenceEnd, importedRows: outcome.importedRows })) };
}
