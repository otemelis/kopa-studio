import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { RecomputeAppleAdsAssessment } from "@/components/recompute-apple-ads-assessment";
import { requireUser } from "@/lib/auth";
import { getAppleAdsRecommendationData } from "@/repositories/apple-ads-recommendation-repository";

export const dynamic = "force-dynamic";

const label = (value: string | null | undefined) => value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
const money = (value: number, currency: string | null) => new Intl.NumberFormat("en-GB", { style: "currency", currency: currency ?? "EUR", maximumFractionDigits: 4 }).format(value);
const evidenceLine = (row: Awaited<ReturnType<typeof getAppleAdsRecommendationData>>["rows"][number]) => {
  if (!row.evidence) return "No numeric evidence stored.";
  return `${row.evidence.impressions} impressions · ${row.evidence.taps} taps · ${row.evidence.installs} installs · ${money(row.evidence.spend, row.evidence.currency)}`;
};

export default async function RecommendationsPage() {
  const user = await requireUser();
  const { rows, diagnoses } = await getAppleAdsRecommendationData(user.id);

  return <PageShell title="Apple Ads recommendations">
    <section className="notice">
      <h2>Read-only evidence assessment</h2>
      <p>Kopa explains the evidence and proposes owner-reviewed actions. It does not add negatives, pause keywords, change bids, or modify Apple Ads.</p>
      <RecomputeAppleAdsAssessment />
    </section>

    {diagnoses.map((diagnosis) => <section key={diagnosis.snapshotId}>
      <div className="section-head">
        <h2>{diagnosis.campaignName ?? "Campaign diagnosis"} · {diagnosis.storefront ?? "Unknown market"}</h2>
        <span>{diagnosis.evidenceWindow ? `${diagnosis.evidenceWindow.start} to ${diagnosis.evidenceWindow.end}` : "Evidence window unavailable"}</span>
      </div>
      {diagnosis.dataFreshness !== "fresh" || diagnosis.dataCompleteness !== "complete" ? <div className="notice">
        <h3>{diagnosis.dataFreshness === "stale" ? "Stale evidence" : "Partial evidence"}</h3>
        <p>Action recommendations are blocked until reporting is fresh and complete. Informational evidence-sufficiency conclusions remain visible.</p>
      </div> : null}
      <div className="metric-grid">
        <article className="metric-card"><p>Traffic quality</p><strong>{label(diagnosis.trafficQuality?.state)}</strong><small>{label(diagnosis.trafficQuality?.confidence)} relevance confidence</small></article>
        <article className="metric-card"><p>Conversion evidence</p><strong>{label(diagnosis.conversionEvidence?.state)}</strong><small>{diagnosis.conversionEvidence?.explanation ?? "Not assessed"}</small></article>
        <article className="metric-card"><p>Taps available</p><strong>{diagnosis.totals?.taps ?? 0}</strong><small>For conversion assessment</small></article>
        <article className="metric-card"><p>Installs</p><strong>{diagnosis.totals?.installs ?? 0}</strong><small>Within the stored evidence window</small></article>
        <article className="metric-card"><p>Spend</p><strong>{money(diagnosis.totals?.spend ?? 0, diagnosis.totals?.currency ?? null)}</strong><small>{diagnosis.totals?.impressions ?? 0} impressions</small></article>
        <article className="metric-card"><p>Data quality</p><strong>{label(diagnosis.dataFreshness)}</strong><small>{label(diagnosis.dataCompleteness)} completeness</small></article>
      </div>
      {diagnosis.trafficQuality?.explanation ? <p className="data-note">{diagnosis.trafficQuality.explanation}</p> : null}
    </section>)}

    {!diagnoses.length && !rows.length ? <section className="notice">
      <h2>No stored assessment</h2>
      <p>Import Apple Ads reporting or recompute after a complete sync. Empty, aggregate, and privacy-suppressed search-term rows will not be turned into actions.</p>
    </section> : null}

    <div className="section-head"><h2>Recommended actions</h2><span>{rows.length} read-only conclusion{rows.length === 1 ? "" : "s"}</span></div>
    <section className="insight-list">
      {rows.map((row) => <article className="insight-card recommendation-card" key={row.id}>
        <div className="recommendation-meta">
          <span>{row.type.replace(/_/g, " ")}</span>
          <span>{row.storefront ?? "Unknown market"}</span>
          <span>{row.evidenceWindow ? `${row.evidenceWindow.start}–${row.evidenceWindow.end}` : "Window unavailable"}</span>
        </div>
        <h2>{row.title}</h2>
        <p><strong>Observation:</strong> {row.observation}</p>
        <p><strong>Diagnosis:</strong> {row.diagnosis}</p>
        <p><strong>Proposed action:</strong> {row.proposedAction}</p>
        <p><strong>Evidence:</strong> {evidenceLine(row)}</p>
        <p><strong>Source:</strong> {row.evidence?.sourceKeyword ?? row.targetText ?? "Campaign"}{row.evidence?.matchType ? ` · ${row.evidence.matchType}` : ""}</p>
        <p><strong>Review condition:</strong> {row.reviewCondition}</p>
        <footer>
          Traffic relevance: {label(row.evidenceQuality?.trafficRelevance)} · Evidence volume: {label(row.evidenceQuality?.evidenceVolume)} · Confidence: {label(row.evidenceQuality?.confidence)} · Data freshness: {label(row.evidenceQuality?.dataFreshness)} · Completeness: {label(row.evidenceQuality?.dataCompleteness)}
        </footer>
      </article>)}
    </section>

    <section className="notice">
      <h2>Unified Actions feed</h2>
      <p>These stored results also appear in <Link href="/insights?source=Apple+Ads">Recommendations</Link>. This page retains the full Apple Ads evidence detail.</p>
    </section>
  </PageShell>;
}
