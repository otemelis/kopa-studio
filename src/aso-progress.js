// Small, source-preserving helpers for the ASO progress view.

export function isoDay(value) {
  return String(value ?? "").slice(0, 10);
}

export function addCalendarDays(day, amount) {
  const date = new Date(`${isoDay(day)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function compareRankWindow(rows, days) {
  const observations = [...rows]
    .filter((row) => row?.captured_at && row.collection_status !== "failed")
    .sort((a, b) => String(a.captured_at).localeCompare(String(b.captured_at)));
  if (observations.length < 2) return { state: "insufficient", current: observations.at(-1) ?? null, previous: null, delta: null };

  const current = observations.at(-1);
  const target = new Date(current.captured_at).getTime() - days * 86400000;
  const previous = observations
    .slice(0, -1)
    .map((row) => ({ row, distance: Math.abs(new Date(row.captured_at).getTime() - target) }))
    .filter((item) => new Date(item.row.captured_at).getTime() < new Date(current.captured_at).getTime())
    .sort((a, b) => a.distance - b.distance)[0];

  // Do not compare distant observations and call them a 7/28-day movement.
  if (!previous || previous.distance > 3 * 86400000) return { state: "insufficient", current, previous: previous?.row ?? null, delta: null };
  if (!current.found || current.rank == null || !previous.row.found || previous.row.rank == null) {
    return { state: "not_observed", current, previous: previous.row, delta: null };
  }
  return { state: "comparable", current, previous: previous.row, delta: previous.row.rank - current.rank };
}

export function compareRankAroundChange(rows, changeDay, days) {
  const previousStart = addCalendarDays(changeDay, -days);
  const previousEnd = addCalendarDays(changeDay, -1);
  const currentStart = addCalendarDays(changeDay, 1);
  const currentEnd = addCalendarDays(changeDay, days);
  const eligible = rows.filter((row) => row?.captured_at && row.collection_status !== "failed");
  const previous = eligible.filter((row) => {
    const day = isoDay(row.captured_on || row.captured_at);
    return day >= previousStart && day <= previousEnd;
  }).sort((a, b) => String(a.captured_at).localeCompare(String(b.captured_at))).at(-1) ?? null;
  const current = eligible.filter((row) => {
    const day = isoDay(row.captured_on || row.captured_at);
    return day >= currentStart && day <= currentEnd;
  }).sort((a, b) => String(a.captured_at).localeCompare(String(b.captured_at))).at(-1) ?? null;
  if (!previous || !current) return { state: "insufficient", current, previous, delta: null };
  if (!current.found || current.rank == null || !previous.found || previous.rank == null) return { state: "not_observed", current, previous, delta: null };
  return { state: "comparable", current, previous, delta: previous.rank - current.rank };
}

export function summarizeMetricWindow(rows, { start, end, event, sourceType, country }) {
  const expectedDays = Math.max(0, Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1);
  const matching = rows.filter((row) =>
    isoDay(row.date) >= start && isoDay(row.date) <= end &&
    (!country || row.country === country) &&
    (!event || row.event === event) &&
    (!sourceType || row.source_type === sourceType),
  );
  if (!matching.length) return { available: false, value: null, rows: 0, days: 0, expectedDays };
  return {
    available: true,
    value: matching.reduce((total, row) => total + Number(row.count ?? 0), 0),
    rows: matching.length,
    days: new Set(matching.map((row) => isoDay(row.date))).size,
    expectedDays,
  };
}

export function parseCsv(text) {
  const lines = String(text ?? "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line) => {
    const cells = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(value); value = ""; }
      else value += char;
    }
    cells.push(value);
    return cells;
  };
  const headers = parseLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ""));
  return lines.slice(1).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index], value])))
    .filter((row) => Object.values(row).some(Boolean));
}

export function summarizeSnapshotDownloads(rows, { app, start, end, acquisitionSource = "All sources" }) {
  const expectedDays = Math.max(0, Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1);
  const knownStatuses = new Set(["reported_value", "zero_no_rows_in_validated_standard_extract"]);
  const matching = rows.filter((row) =>
    row.app === app && row.metric === "first_time_downloads" &&
    row.scope === (acquisitionSource === "All sources" ? "summary" : "source_breakdown") &&
    row.acquisition_source === acquisitionSource && row.date >= start && row.date <= end && knownStatuses.has(row.data_quality_status),
  );
  const dates = new Set(matching.map((row) => row.date));
  return {
    available: matching.length > 0,
    complete: dates.size === expectedDays,
    value: matching.length ? matching.reduce((sum, row) => sum + Number(row.value), 0) : null,
    days: dates.size,
    expectedDays,
    start,
    end,
  };
}

export function compareAcquisitionWindows(rows, anchorDay, days, dimensions = {}) {
  const beforeStart = addCalendarDays(anchorDay, -days);
  const beforeEnd = addCalendarDays(anchorDay, -1);
  const afterStart = addCalendarDays(anchorDay, 1);
  const afterEnd = addCalendarDays(anchorDay, days);
  const summarize = (start, end, event) => summarizeMetricWindow(rows, {
    start, end, event, sourceType: "App Store search", ...dimensions,
  });
  return {
    before: { start: beforeStart, end: beforeEnd, impressions: summarize(beforeStart, beforeEnd, "Impression"), pageViews: summarize(beforeStart, beforeEnd, "Page view") },
    after: { start: afterStart, end: afterEnd, impressions: summarize(afterStart, afterEnd, "Impression"), pageViews: summarize(afterStart, afterEnd, "Page view") },
  };
}

export function compareRecentAcquisitionWindows(rows, endDay, days, dimensions = {}) {
  const afterStart = addCalendarDays(endDay, -(days - 1));
  const beforeEnd = addCalendarDays(afterStart, -1);
  const beforeStart = addCalendarDays(beforeEnd, -(days - 1));
  const summarize = (start, end, event) => summarizeMetricWindow(rows, {
    start, end, event, sourceType: "App Store search", ...dimensions,
  });
  return {
    before: { start: beforeStart, end: beforeEnd, impressions: summarize(beforeStart, beforeEnd, "Impression"), pageViews: summarize(beforeStart, beforeEnd, "Page view") },
    after: { start: afterStart, end: endDay, impressions: summarize(afterStart, endDay, "Impression"), pageViews: summarize(afterStart, endDay, "Page view") },
  };
}

export function assessAsoprogress(rankMovements, acquisitionComparison, downloadComparison = null) {
  const comparable = rankMovements.filter((row) => row.state === "comparable");
  const { before, after } = acquisitionComparison;
  if (!comparable.length || !before.impressions.available || !after.impressions.available || before.impressions.days !== before.impressions.expectedDays || after.impressions.days !== after.impressions.expectedDays) {
    return { status: "insufficient evidence", explanation: "Need comparable source-specific keyword observations and complete App Store Search impression coverage in both periods." };
  }
  const improved = comparable.filter((row) => row.delta > 0).length;
  const declined = comparable.filter((row) => row.delta < 0).length;
  const rankDirection = improved === declined ? "mixed" : improved > declined ? "up" : "down";
  const impressionDirection = after.impressions.value === before.impressions.value ? "flat" : after.impressions.value > before.impressions.value ? "up" : "down";
  const downloadsAvailable = downloadComparison?.before?.available && downloadComparison?.after?.available &&
    downloadComparison.before.days === downloadComparison.before.expectedDays && downloadComparison.after.days === downloadComparison.after.expectedDays;
  const downloadDirection = downloadsAvailable
    ? downloadComparison.after.value === downloadComparison.before.value ? "flat" : downloadComparison.after.value > downloadComparison.before.value ? "up" : "down"
    : null;
  const downloadsNote = downloadsAvailable ? ` Validated all-storefront first-time downloads ${downloadDirection === "up" ? "increased" : downloadDirection === "down" ? "decreased" : "were unchanged"} (${downloadComparison.before.start}–${downloadComparison.before.end}: ${downloadComparison.before.days}/${downloadComparison.before.expectedDays} reported days; ${downloadComparison.after.start}–${downloadComparison.after.end}: ${downloadComparison.after.days}/${downloadComparison.after.expectedDays}).` : " First-time download comparison is unavailable for these periods.";
  if (rankDirection === "up" && impressionDirection === "up" && (!downloadsAvailable || downloadDirection === "up")) return { status: "improving", explanation: `More tracked terms moved up and reported App Store Search impressions increased.${downloadsNote}` };
  if (rankDirection === "down" && impressionDirection === "down" && (!downloadsAvailable || downloadDirection === "down")) return { status: "declining", explanation: `More tracked terms moved down and reported App Store Search impressions decreased.${downloadsNote}` };
  if (rankDirection === "mixed" && impressionDirection === "flat") return { status: "mixed", explanation: "Keyword movement was mixed and reported impressions were unchanged." };
  return { status: "mixed", explanation: `Keyword movement and App Store Search impressions did not move in the same direction.${downloadsNote}` };
}
