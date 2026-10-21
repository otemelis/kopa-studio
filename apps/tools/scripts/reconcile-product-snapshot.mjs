/** Independent SQL -> API aggregate reconciliation. Uses the isolated SELECT-only role. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { Pool } from "pg";
const config = JSON.parse(
  fs.readFileSync(process.env.KOPA_PRODUCT_DATABASE_CONFIG, "utf8"),
);
assert.equal(config.user, "signal_reader");
assert.equal(config.database, "kopa_innertype");
assert.match(config.host, /^\/private\/tmp\/kopa-inner-signal-[a-z0-9]+$/);
const db = new Pool({
  host: config.host,
  port: config.port,
  user: config.user,
  database: config.database,
  options: "-c default_transaction_read_only=on",
});
const origin =
  process.env.KOPA_PRODUCT_PREVIEW_ORIGIN || "http://127.0.0.1:4339";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const scopes = [
  "",
  "start=2026-07-12&end=2026-10-15",
  "country=US",
  "language=de",
  "version=1.1.0",
  "assessment=relationship",
  "funnel=purchase",
  "start=2026-01-01&end=2026-01-07",
];
const results = [];
try {
  for (const query of scopes) {
    const response = await fetch(origin + "/api/signal/product?" + query);
    assert.equal(response.status, 200);
    const body = await response.json(),
      report = body.report,
      scope = report.scope;
    assert.doesNotMatch(
      JSON.stringify(report),
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
      "Raw identity must not leave the server",
    );
    const filters = [
      scope.country,
      scope.version,
      scope.language,
      scope.source,
      scope.assessment,
    ];
    const base = `WITH e AS (SELECT * FROM signal_source.events WHERE app_id='innertype' AND environment='prod' AND received_at <= $1::timestamptz AND ($4='ALL' OR country=$4) AND ($5='ALL' OR app_version=$5) AND ($6='ALL' OR properties->>'language'=$6) AND ($7='ALL' OR COALESCE(properties->>'source','unknown')=$7) AND ($8='ALL' OR COALESCE(properties->>'assessment_type','unknown')=$8))`;
    const args = [
      report.source.asOf,
      scope.start + "T00:00:00Z",
      scope.end + "T00:00:00Z",
      ...filters,
    ];
    const {
      rows: [counts],
    } = await db.query(
      base +
        ` SELECT count(*)::int AS events, count(DISTINCT session_id)::int AS sessions, count(*) FILTER(WHERE event_name='purchase_success')::int AS purchases FROM e WHERE client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day'`,
      args,
    );
    assert.equal(counts.events, report.metrics.events);
    assert.equal(counts.sessions, report.metrics.sessions);
    assert.equal(counts.purchases, report.metrics.purchaseSignals);
    assert.equal(report.purchaseEvidence.events, counts.purchases);
    assert.equal(report.purchaseEvidence.verifiedAppleTransactions, null);
    const { rows: purchaseDays } = await db.query(
      base +
        `SELECT to_char(client_event_time AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,count(*)::int AS events FROM e WHERE event_name='purchase_success' AND client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day' GROUP BY 1 ORDER BY 1`,
      args,
    );
    assert.deepEqual(report.purchaseEvidence.days, purchaseDays);
    const steps =
      scope.funnel === "assessment"
        ? ["assessment_started", "assessment_completed", "result_viewed"]
        : ["paywall_viewed", "purchase_tapped", "purchase_success"];
    const sameType =
      scope.funnel === "assessment"
        ? "AND c.properties->>'assessment_type'=s.properties->>'assessment_type'"
        : "";
    const thirdType =
      scope.funnel === "assessment"
        ? "AND r.properties->>'assessment_type'=s.properties->>'assessment_type'"
        : "";
    const sql =
      base +
      `, starts AS (SELECT * FROM e WHERE event_name=$9 AND client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day'), second AS (SELECT DISTINCT s.session_id FROM starts s JOIN e c ON c.session_id=s.session_id AND c.event_name=$10 AND c.client_event_time>s.client_event_time AND c.client_event_time<=s.client_event_time+interval '24 hours' ${sameType}), third AS (SELECT DISTINCT s.session_id FROM starts s JOIN e c ON c.session_id=s.session_id AND c.event_name=$10 AND c.client_event_time>s.client_event_time AND c.client_event_time<=s.client_event_time+interval '24 hours' ${sameType} JOIN e r ON r.session_id=s.session_id AND r.event_name=$11 AND r.client_event_time>c.client_event_time AND r.client_event_time<=s.client_event_time+interval '24 hours' ${thirdType}) SELECT (SELECT count(DISTINCT session_id)::int FROM starts) AS entered,(SELECT count(*)::int FROM second) AS second,(SELECT count(*)::int FROM third) AS third`;
    const {
      rows: [funnel],
    } = await db.query(sql, [...args, ...steps]);
    const expected = [funnel.entered, funnel.second, funnel.third];
    assert.deepEqual(
      report.funnel.steps.map((s) => s.sessions),
      expected,
    );
    assert.equal(
      report.funnel.steps[2].conversion,
      expected[0] ? expected[2] / expected[0] : null,
    );
    const priorArgs = [
      report.source.asOf,
      report.comparison.start + "T00:00:00Z",
      report.comparison.end + "T00:00:00Z",
      ...filters,
    ];
    const {
      rows: [priorFunnel],
    } = await db.query(sql, [...priorArgs, ...steps]);
    assert.deepEqual(
      report.previousFunnel.steps.map((s) => s.sessions),
      [priorFunnel.entered, priorFunnel.second, priorFunnel.third],
    );
    const {
      rows: [priorCounts],
    } = await db.query(
      base +
        `SELECT count(*)::int AS events,count(DISTINCT session_id)::int AS sessions FROM e WHERE client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day'`,
      priorArgs,
    );
    assert.equal(report.previous.events, priorCounts.events);
    assert.equal(report.previous.sessions, priorCounts.sessions);
    const { rows: priorDaily } = await db.query(
      base +
        `SELECT to_char(client_event_time AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,count(*)::int AS events,count(DISTINCT session_id)::int AS sessions FROM e WHERE client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day' GROUP BY 1`,
      priorArgs,
    );
    for (const point of report.trend) {
      const row = priorDaily.find((d) => d.date === point.priorDate);
      assert.equal(point.previousEvents, row?.events ?? null);
      assert.equal(point.previousSessions, row?.sessions ?? null);
    }
    const { rows: events } = await db.query(
      base +
        ` SELECT event_name,count(*)::int AS count FROM e WHERE client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day' GROUP BY event_name`,
      args,
    );
    for (const row of report.eventFrequencies)
      assert.equal(
        row.events,
        events.find((e) => e.event_name === row.name)?.count || 0,
      );
    const { rows: daily } = await db.query(
      base +
        ` SELECT to_char(client_event_time AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,count(*)::int AS events,count(DISTINCT session_id)::int AS sessions FROM e WHERE client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day' GROUP BY 1`,
      args,
    );
    for (const point of report.trend) {
      const row = daily.find((d) => d.date === point.date);
      assert.equal(point.events, row?.events ?? null);
      assert.equal(point.sessions, row?.sessions ?? null);
    }
    assert.equal(
      report.journey.sessions,
      (
        await db.query(
          base +
            `SELECT count(DISTINCT session_id)::int AS n FROM e WHERE event_name=$9 AND client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day'`,
          [...args, scope.journey],
        )
      ).rows[0].n,
    );
    const relevant = [
      "app_opened",
      "assessment_started",
      "assessment_completed",
      "result_viewed",
      "assessment_exited",
      "assessment_abandoned",
      "paywall_viewed",
      "purchase_tapped",
      "purchase_success",
      "purchase_cancelled",
      "share_card_viewed",
      "share_card_shared",
    ];
    const pathType =
      scope.journey === "assessment_started"
        ? "AND (COALESCE(c.properties->>'assessment_type','unknown')='unknown' OR c.properties->>'assessment_type'=s.properties->>'assessment_type')"
        : "";
    const pathCandidates = `c.session_id=s.session_id AND c.event_name=ANY($10::text[]) AND c.event_name<>s.event_name AND c.client_event_time<=s.client_event_time+interval '24 hours' ${pathType}`;
    const pathSQL =
      base +
      `, starts AS (SELECT DISTINCT ON(session_id) * FROM e WHERE event_name=$9 AND client_event_time >= $2::timestamptz AND client_event_time < $3::timestamptz + interval '1 day' ORDER BY session_id,client_event_time,id), branches AS (SELECT CASE WHEN $9='assessment_started' AND COALESCE(s.properties->>'assessment_type','unknown')='unknown' THEN 'Missing assessment type' WHEN EXISTS(SELECT 1 FROM e c WHERE ${pathCandidates} AND c.client_event_time=s.client_event_time) THEN 'Ambiguous event order' WHEN n.event_name IS NULL AND s.client_event_time+interval '24 hours'>$1::timestamptz THEN 'Observation still open' WHEN n.event_name IS NULL THEN 'No next recorded step' WHEN EXISTS(SELECT 1 FROM e c WHERE ${pathCandidates} AND c.client_event_time=n.client_event_time AND c.event_name<>n.event_name) THEN 'Ambiguous event order' ELSE n.event_name END AS name FROM starts s LEFT JOIN LATERAL(SELECT c.event_name,c.client_event_time FROM e c WHERE ${pathCandidates} AND c.client_event_time>s.client_event_time ORDER BY c.client_event_time,c.id LIMIT 1)n ON true) SELECT name,count(*)::int AS sessions FROM branches GROUP BY name ORDER BY name`;
    const { rows: branches } = await db.query(pathSQL, [
      ...args,
      scope.journey,
      relevant,
    ]);
    assert.deepEqual(
      report.journey.children
        .map(({ name, sessions }) => ({ name, sessions }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      branches.sort((a, b) => a.name.localeCompare(b.name)),
    );
    const conserve = (node) => {
      if (node.children.length)
        assert.equal(
          node.children.reduce((sum, c) => sum + c.sessions, 0),
          node.sessions,
        );
      node.children.forEach(conserve);
    };
    conserve(report.journey);
    results.push({
      scope,
      sqlMetrics: counts,
      apiMetrics: report.metrics,
      sqlFunnel: expected,
      apiFunnel: report.funnel.steps.map((s) => s.sessions),
      journeyEntries: report.journey.sessions,
      eventRowsMatch: true,
      purchaseEvidenceMatchesSQL: true,
      trendPointsMatch: true,
      journeyConserved: true,
      firstJourneyBranchesMatchSQL: true,
      previousPeriodMatchesSQL: true,
      noRawIds: true,
    });
  }
  const {
    rows: [quality],
  } = await db.query(
    `WITH e AS (SELECT * FROM signal_source.events WHERE app_id='innertype' AND environment='prod'), fragmented AS (SELECT session_id FROM e GROUP BY session_id HAVING count(DISTINCT anonymous_id)>1) SELECT count(*)::int AS rows,count(DISTINCT session_id)::int AS sessions,count(DISTINCT anonymous_id)::int AS anonymous_ids,(SELECT count(*)::int FROM fragmented) AS fragmented_sessions,(count(*)-count(DISTINCT (to_jsonb(e)-'id'-'received_at')))::int AS possible_duplicates FROM e`,
  );
  assert.deepEqual(quality, {
    rows: 9183,
    sessions: 234,
    anonymous_ids: 322,
    fragmented_sessions: 107,
    possible_duplicates: 281,
  });
  const failures = [];
  for (const [query, headers, status] of [
    ["app=pois", {}, 503],
    ["data=sample", {}, 400],
    ["", { Origin: "https://untrusted.example" }, 403],
  ]) {
    const response = await fetch(origin + "/api/signal/product?" + query, {
      headers,
    });
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.report, undefined);
    failures.push({ query, expectedStatus: status, passed: true });
  }
  const result = {
    verifiedAt: new Date().toISOString(),
    sourceAsOf: "2026-10-15T06:40:58.000Z",
    method:
      "Independent PostgreSQL SELECT aggregates versus real API/plot/export DTO",
    productionWrites: 0,
    quality,
    scopes: results,
    failureGuards: failures,
    passed: true,
  };
  if (process.env.KOPA_RECONCILIATION_OUTPUT)
    fs.writeFileSync(
      process.env.KOPA_RECONCILIATION_OUTPUT,
      JSON.stringify(result, null, 2) + "\n",
    );
  console.log(
    JSON.stringify({
      passed: true,
      scopes: results.length,
      quality,
      failureGuards: failures.length,
    }),
  );
} finally {
  await db.end();
}
