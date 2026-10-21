import { createAdminClient } from "@/lib/supabase/admin";
import { zip } from "@/lib/zip";

export type ReviewPackInput = { appId: string; market: string; startDate: string; endDate: string; includeComparisonMarkets: boolean; includeRawSourceRows: boolean };
const csv = (rows: Record<string, unknown>[]) => { const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]; const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; return `${columns.join(",")}\n${rows.map((row) => columns.map((key) => cell(row[key])).join(",")).join("\n")}\n`; };
const text = (value: unknown) => typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
const evidence = (table: string, start: string, end: string) => `[source: ${table}; evidence window: ${start} to ${end}]`;
const dateOnly = (value: string) => value.slice(0, 10);

export async function createReviewPack(input: ReviewPackInput) {
  const db = createAdminClient();
  const { data: app, error: appError } = await db.from("aso_apps").select("id,name,subtitle,description,primary_country,current_version,release_notes,store_url,updated_at").eq("id", input.appId).maybeSingle();
  if (appError || !app) throw new Error("Selected app was not found.");
  const market = input.market.toLowerCase();
  const applyMarket = <T,>(query: T, field = "country"): T => input.includeComparisonMarkets || market === "all" ? query : (query as unknown as { eq(field: string, value: string): T }).eq(field, market);
  const dateRange = <T,>(query: T, field: string): T => (query as unknown as { gte(field: string, value: string): { lte(field: string, value: string): T } }).gte(field, input.startDate).lte(field, input.endDate);
  const [campaigns, adGroups, appleKeywords, searchTerms, appKeywords, ranks, storefronts, ascMetrics, dailyMetrics, metadata, changes, insights, recommendations] = await Promise.all([
    db.from("apple_ads_campaigns").select("id,app_id,apple_campaign_id,name,status,serving_status,daily_budget_amount,currency,countries_or_regions,source_synced_at,raw_payload").eq("app_id", input.appId),
    db.from("apple_ads_ad_groups").select("id,campaign_id,apple_ad_group_id,name,status,serving_status,default_bid_amount,currency,source_synced_at,raw_payload"),
    db.from("apple_ads_keywords").select("id,campaign_id,ad_group_id,apple_keyword_id,keyword_text,match_type,status,serving_status,bid_amount,currency,source_synced_at,raw_payload"),
    applyMarket(dateRange(db.from("apple_ads_search_terms").select("id,app_id,campaign_id,ad_group_id,keyword_id,search_term,source_keyword_text,match_source,country,metric_date,impressions,taps,installs,spend,currency,source_synced_at,raw_payload").eq("app_id", input.appId), "metric_date")),
    db.from("aso_app_keywords").select("app_id,keyword_id,aso_keywords(id,term,country,language,priority,notes,created_at)").eq("app_id", input.appId),
    dateRange(db.from("aso_keyword_rank_snapshots").select("keyword_id,store_app_id,app_kind,captured_at,rank,found,result_depth,change_7d,change_30d,best_rank,collection_status,source"), "captured_at"),
    applyMarket(db.from("aso_app_storefronts").select("app_id,country,is_primary,metadata_localised,screenshots_localised,notes").eq("app_id", input.appId)),
    applyMarket(dateRange(db.from("aso_storefront_metrics").select("app_id,date,country,event,page_type,source_type,count,unique_count,source").eq("app_id", input.appId), "date")),
    applyMarket(dateRange(db.from("aso_daily_metrics").select("app_id,date,country,impressions,page_views,downloads,proceeds,source").eq("app_id", input.appId), "date")),
    applyMarket(dateRange(db.from("aso_metadata_snapshots").select("app_id,country,locale,captured_at,name,subtitle,description,current_version,release_notes,price,source").eq("app_id", input.appId), "captured_at")),
    applyMarket(dateRange(db.from("aso_metadata_change_events").select("app_id,country,locale,change_type,field,old_value,new_value,happened_at,note,origin,source").eq("app_id", input.appId), "happened_at")),
    applyMarket(db.from("aso_insights").select("rule_id,country,title,observation,recommendation,evidence,comparison_window,priority,status,created_at").eq("app_id", input.appId).eq("status", "active").order("priority", { ascending: false }).limit(5)),
    db.from("apple_ads_recommendations").select("recommendation_type,title,evidence_summary,deterministic_rationale,priority,generated_at,status").eq("app_id", input.appId).eq("status", "active").order("priority", { ascending: false }).limit(5),
  ]);
  const results = [campaigns, adGroups, appleKeywords, searchTerms, appKeywords, ranks, storefronts, ascMetrics, dailyMetrics, metadata, changes, insights, recommendations];
  const failed = results.find((result) => result.error); if (failed?.error) throw new Error(`Could not prepare review pack: ${failed.error.message}`);
  const compact = (rows: Record<string, unknown>[] | null | undefined) => (rows ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => input.includeRawSourceRows || key !== "raw_payload").map(([key, value]) => [key, typeof value === "object" && value !== null ? text(value) : value])));
  const campaignRows = compact(campaigns.data as Record<string, unknown>[]); const campaignIds = new Set(campaignRows.map((row) => String(row.id)));
  const groupRows = compact((adGroups.data as Record<string, unknown>[]).filter((row) => campaignIds.has(String(row.campaign_id))));
  const keywordRows = compact((appleKeywords.data as Record<string, unknown>[]).filter((row) => campaignIds.has(String(row.campaign_id))));
  const asoKeywordRows = compact((appKeywords.data as Record<string, unknown>[]).map((row) => ({ app_id: row.app_id, ...(row.aso_keywords as Record<string, unknown> ?? {}) })));
  const appKeywordIds = new Set(asoKeywordRows.map((row) => String(row.id)));
  const rankRows = compact((ranks.data as Record<string, unknown>[]).filter((row) => appKeywordIds.has(String(row.keyword_id))));
  const gaps = rankRows.filter((row) => row.app_kind === "competitor" && row.found === true).map((row) => ({ keyword_id: row.keyword_id, competitor_store_app_id: row.store_app_id, competitor_rank: row.rank, captured_at: row.captured_at, evidence: evidence("aso_keyword_rank_snapshots", input.startDate, input.endDate) }));
  const storefrontRows = compact(storefronts.data as Record<string, unknown>[]); const searchRows = compact(searchTerms.data as Record<string, unknown>[]); const ascRows = [...compact(ascMetrics.data as Record<string, unknown>[]).map((row) => ({ source_table: "aso_storefront_metrics", ...row })), ...compact(dailyMetrics.data as Record<string, unknown>[]).map((row) => ({ source_table: "aso_daily_metrics", ...row }))];
  const quality = [
    !campaignRows.length ? { issue: "No Apple Ads campaigns mapped to selected app", source_table: "apple_ads_campaigns", evidence_window: `${input.startDate} to ${input.endDate}` } : null,
    !searchRows.length ? { issue: "No Apple Ads search-term rows in scope", source_table: "apple_ads_search_terms", evidence_window: `${input.startDate} to ${input.endDate}` } : null,
    !ascRows.length ? { issue: "No App Store Connect metrics in scope", source_table: "aso_storefront_metrics, aso_daily_metrics", evidence_window: `${input.startDate} to ${input.endDate}` } : null,
    ...storefrontRows.filter((row) => row.metadata_localised !== true || row.screenshots_localised !== true).map((row) => ({ issue: `Localization incomplete for ${row.country}`, source_table: "aso_app_storefronts", evidence_window: `${input.startDate} to ${input.endDate}` })),
  ].filter(Boolean) as Record<string, unknown>[];
  const changeLines = compact(changes.data as Record<string, unknown>[]).slice(0, 5).map((row) => `- ${row.change_type}${row.field ? `: ${row.field}` : ""} ${evidence("aso_metadata_change_events", input.startDate, input.endDate)}`);
  const insightLines = compact(insights.data as Record<string, unknown>[]).map((row) => `- Deterministic / recorded finding: ${row.title} — ${row.recommendation} ${evidence("aso_insights", input.startDate, input.endDate)}`);
  const adLines = compact(recommendations.data as Record<string, unknown>[]).map((row) => `- Deterministic rules: ${row.title} — ${row.deterministic_rationale} ${evidence("apple_ads_recommendations", input.startDate, input.endDate)}`);
  const qualityLines = quality.map((row) => `- ${row.issue} ${evidence(String(row.source_table), input.startDate, input.endDate)}`);
  const summary = [
    "# Decision summary", "", "No AI interpretation is included in this export. Deterministic findings and recorded rule findings are labelled below.", "",
    "## What changed", ...(changeLines.length ? changeLines : [`- No metadata change rows in scope ${evidence("aso_metadata_change_events", input.startDate, input.endDate)}`]), "",
    "## What is working", `- ${campaignRows.length} mapped Apple Ads campaign row(s) and ${searchRows.length} search-term row(s) are available ${evidence("apple_ads_campaigns, apple_ads_search_terms", input.startDate, input.endDate)}`, "",
    "## What is not working", ...(qualityLines.length ? qualityLines : [`- No deterministic blocker detected in exported checks ${evidence("data_quality_issues", input.startDate, input.endDate)}`]), "",
    "## What data is insufficient", ...(!searchRows.length || !ascRows.length ? qualityLines : [`- No insufficiency inferred beyond the exported source windows ${evidence("manifest.json", input.startDate, input.endDate)}`]), "",
    "## What to do now", ...(insightLines.length ? insightLines.slice(0, 3) : [`- Review the exported source rows before changing metadata or bids ${evidence("manifest.json", input.startDate, input.endDate)}`]), "",
    "## What to wait for", `- Wait for additional source rows where the selected window is empty; this export does not infer missing values ${evidence("manifest.json", input.startDate, input.endDate)}`, "",
    "## What to stop", `- Do not treat absent rows as zero performance ${evidence("manifest.json", input.startDate, input.endDate)}`, "",
    "## Top five ASO opportunities", ...(insightLines.length ? insightLines : [`- No recorded ASO opportunity in scope ${evidence("aso_insights", input.startDate, input.endDate)}`]), "",
    "## Top five Apple Ads actions", ...(adLines.length ? adLines : [`- No deterministic Apple Ads action in scope ${evidence("apple_ads_recommendations", input.startDate, input.endDate)}`]), "",
    "## Data-quality blockers", ...(qualityLines.length ? qualityLines : [`- No blocker detected by this export ${evidence("data_quality_issues", input.startDate, input.endDate)}`]), "",
  ].join("\n");
  const metadataText = ["# Current metadata", "", `App: ${app.name}`, `Market filter: ${input.market}`, `Name: ${app.name}`, `Subtitle: ${app.subtitle ?? ""}`, `Version: ${app.current_version ?? ""}`, "", app.description ?? "", "", evidence("aso_apps", input.startDate, input.endDate)].join("\n");
  const files = [
    ["apple_ads_campaigns.csv", csv(campaignRows)], ["apple_ads_ad_groups.csv", csv(groupRows)], ["apple_ads_keywords.csv", csv(keywordRows)], ["apple_ads_search_terms.csv", csv(searchRows)], ["aso_keywords.csv", csv(asoKeywordRows)], ["competitor_keyword_gaps.csv", csv(gaps)], ["market_localization_readiness.csv", csv(storefrontRows)], ["app_store_connect_metrics.csv", csv(ascRows)], ["data_quality_issues.csv", csv(quality)], ["current_metadata.md", metadataText], ["decision_summary.md", summary],
  ] as Array<[string, string]>;
  const manifest = { generated_at: new Date().toISOString(), app: { id: app.id, name: app.name }, scope: input, files: Object.fromEntries(files.map(([name, content]) => [name, { bytes: new TextEncoder().encode(content).length, rows: name.endsWith(".csv") ? Math.max(0, content.trim().split("\n").length - 1) : undefined }])), deterministic_findings_only: true, ai_interpretation: "none" };
  files.push(["manifest.json", JSON.stringify(manifest, null, 2)]);
  return { archive: zip(files.map(([name, content]) => ({ name, content }))), filename: `kopa-review-${app.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${input.market.toUpperCase()}-${dateOnly(input.endDate)}.zip` };
}
