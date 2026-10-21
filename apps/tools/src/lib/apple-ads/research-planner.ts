export type PlannerKeyword = { term: string; source: string; reason: string; market?: string };
export type ResearchPlanInput = { appName: string; country: string; yearMonth: string; dailyBudget: number; exact: PlannerKeyword[]; broad: PlannerKeyword[]; negatives?: string[]; searchMatch: boolean; currency: string };
export type ResearchCampaign = { name: string; kind: "exact" | "broad" | "search_match"; keywords: PlannerKeyword[] };
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
function uniqueKeywords(rows: PlannerKeyword[]) {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const term = normalize(row.term);
    if (!term || seen.has(term)) return [];
    seen.add(term);
    return [{ ...row, term }];
  });
}
export function buildResearchPlan(input: ResearchPlanInput) {
  const country = input.country.toUpperCase();
  const prefix = `KOPA | ${input.appName} | ${country}`;
  const exact = uniqueKeywords(input.exact);
  const broad = uniqueKeywords(input.broad);
  const negatives = new Set((input.negatives ?? []).map(normalize).filter(Boolean));
  const campaigns = [exact.length ? { name: `${prefix} | Core Exact | ${input.yearMonth}`, kind: "exact" as const, keywords: exact } : null, broad.length ? { name: `${prefix} | Broad Discovery | ${input.yearMonth}`, kind: "broad" as const, keywords: broad } : null, input.searchMatch ? { name: `${prefix} | Search Match | ${input.yearMonth}`, kind: "search_match" as const, keywords: [] } : null].filter(Boolean) as ResearchCampaign[];
  const all = [...input.exact, ...input.broad].map((keyword) => normalize(keyword.term));
  const duplicates = [...new Set(all.filter((term, index) => term && all.indexOf(term) !== index))];
  const negativeConflicts = [...new Set([...exact, ...broad].map((keyword) => keyword.term).filter((term) => negatives.has(term)))];
  const marketMismatches = [...new Set([...exact, ...broad].filter((keyword) => keyword.market && keyword.market.toLowerCase() !== input.country.toLowerCase()).map((keyword) => `${keyword.term} (${keyword.market})`))];
  return { campaigns, totalPossibleDailySpend: campaigns.length * input.dailyBudget, currency: input.currency, duplicates, negativeConflicts, marketMismatches, requiresApproval: true, activation: "paused" as const };
}
