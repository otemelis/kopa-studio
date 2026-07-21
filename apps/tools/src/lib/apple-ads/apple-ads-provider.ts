import { getAppleAdsConfiguration } from "./config";
import { EnvironmentCredentialStore, type CredentialStore } from "./credential-store";
import type { AppleAdsAdGroup, AppleAdsCampaign, AppleAdsCampaignReport, AppleAdsKeyword, AppleAdsOrganization, AppleAdsProvider, AppleAdsSearchTermReport, ConnectionResult } from "./provider";

const TOKEN_URL = "https://appleid.apple.com/auth/oauth2/token";

type TokenPayload = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
let cachedToken: { value: string; expiresAt: number } | null = null;

function safeMessage(status: number, payload: unknown) {
  const data = payload as { error?: string; error_description?: string; message?: string } | null;
  return data?.error_description || data?.message || data?.error || `Apple Ads returned HTTP ${status}.`;
}

function booleanField(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

export function mapAppleAdsAdGroup(row: Record<string, unknown>, campaignId: string): AppleAdsAdGroup {
  const defaultBidAmount = row.defaultBidAmount as { amount?: unknown; currency?: unknown } | null;
  return {
    id: String(row.id),
    campaignId,
    name: String(row.name ?? "Unnamed ad group"),
    status: String(row.status ?? "UNKNOWN"),
    servingStatus: typeof row.servingStatus === "string" ? row.servingStatus : null,
    defaultBidAmount: typeof defaultBidAmount?.amount === "string" ? defaultBidAmount.amount : null,
    currency: typeof defaultBidAmount?.currency === "string" ? defaultBidAmount.currency : null,
    searchMatchEnabled: booleanField(row.automatedKeywordsOptIn),
    modificationTime: typeof row.modificationTime === "string" ? row.modificationTime : null,
    deleted: row.deleted === true,
    rawPayload: row,
  };
}

export class AppleAdsApiV5Provider implements AppleAdsProvider {
  constructor(private readonly credentialStore: CredentialStore = new EnvironmentCredentialStore()) {}
  async listOrganizations(): Promise<AppleAdsOrganization[]> {
    const token = await this.accessToken();
    const config = getAppleAdsConfiguration();
    const response = await fetch(`${config.apiBaseUrl}/acls`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const payload = await response.json().catch(() => null) as { data?: Array<Record<string, unknown>> } | null;
    if (!response.ok) throw new Error(safeMessage(response.status, payload));
    return (payload?.data ?? []).map((organization) => ({
      id: String(organization.orgId ?? organization.id),
      name: String(organization.orgName ?? organization.name ?? "Unnamed Apple Ads organization"),
      currency: typeof organization.currency === "string" ? organization.currency : undefined,
      timezone: typeof organization.timeZone === "string" ? organization.timeZone : undefined,
    })).filter((organization) => organization.id !== "undefined");
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const organizations = await this.listOrganizations();
      return { ok: true, message: `OAuth succeeded. ${organizations.length} accessible organization${organizations.length === 1 ? "" : "s"} found.`, organizations };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Apple Ads connection test failed.", organizations: [] };
    }
  }

  async listCampaigns(organizationId: string): Promise<AppleAdsCampaign[]> {
    const token = await this.accessToken(); const config = getAppleAdsConfiguration(); const campaigns: AppleAdsCampaign[] = [];
    for (let offset = 0; ; offset += 1000) {
      const response = await fetch(`${config.apiBaseUrl}/campaigns?limit=1000&offset=${offset}`, { headers: { Authorization: `Bearer ${token}`, "X-AP-Context": `orgId=${organizationId}` }, cache: "no-store" });
      const payload = await response.json().catch(() => null) as { data?: Array<Record<string, unknown>>; pagination?: { totalResults?: number } } | null;
      if (!response.ok) throw new Error(safeMessage(response.status, payload));
      const page = payload?.data ?? [];
      campaigns.push(...page.map((campaign) => ({ id: String(campaign.id), adamId: String(campaign.adamId), name: String(campaign.name ?? "Unnamed campaign"), status: String(campaign.status ?? "UNKNOWN"), servingStatus: typeof campaign.servingStatus === "string" ? campaign.servingStatus : null, biddingStrategy: typeof campaign.biddingStrategy === "string" ? campaign.biddingStrategy : null, dailyBudgetAmount: typeof (campaign.dailyBudgetAmount as { amount?: unknown } | null)?.amount === "string" ? (campaign.dailyBudgetAmount as { amount: string }).amount : null, currency: typeof (campaign.dailyBudgetAmount as { currency?: unknown } | null)?.currency === "string" ? (campaign.dailyBudgetAmount as { currency: string }).currency : null, countriesOrRegions: Array.isArray(campaign.countriesOrRegions) ? campaign.countriesOrRegions.filter((v): v is string => typeof v === "string") : [], startTime: typeof campaign.startTime === "string" ? campaign.startTime : null, endTime: typeof campaign.endTime === "string" ? campaign.endTime : null, modificationTime: typeof campaign.modificationTime === "string" ? campaign.modificationTime : null, deleted: campaign.deleted === true, rawPayload: campaign })));
      if (page.length < 1000 || campaigns.length >= (payload?.pagination?.totalResults ?? 0)) break;
    }
    return campaigns;
  }
  async listAdGroups(organizationId: string, campaignId: string): Promise<AppleAdsAdGroup[]> { const rows = await this.list(organizationId, `/campaigns/${campaignId}/adgroups`); return rows.map((row) => mapAppleAdsAdGroup(row, campaignId)); }
  async listKeywords(organizationId: string, campaignId: string, adGroupId: string): Promise<AppleAdsKeyword[]> { return this.listKeywordLike(organizationId, `/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords`, adGroupId); }
  async listNegativeKeywords(organizationId: string, campaignId: string, adGroupId: string): Promise<AppleAdsKeyword[]> { return this.listKeywordLike(organizationId, `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords`, adGroupId); }
  async fetchCampaignReport(organizationId:string,campaignId:string,startDate:string,endDate:string):Promise<AppleAdsCampaignReport>{const token=await this.accessToken(),config=getAppleAdsConfiguration();const response=await fetch(`${config.apiBaseUrl}/reports/campaigns`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"X-AP-Context":`orgId=${organizationId}`,"Content-Type":"application/json"},body:JSON.stringify({startTime:startDate,endTime:endDate,granularity:"DAILY",timeZone:"UTC",returnRowTotals:false,returnGrandTotals:false,returnRecordsWithNoMetrics:false,selector:{conditions:[{field:"campaignId",operator:"EQUALS",values:[campaignId]}],pagination:{offset:0,limit:1}}}),cache:"no-store"});const raw=await response.json().catch(()=>null) as Record<string,unknown>|null;if(!response.ok)throw new Error(safeMessage(response.status,raw));return {raw:raw??{}};}
  async fetchSearchTermReport(organizationId:string,campaignId:string,startDate:string,endDate:string):Promise<AppleAdsSearchTermReport>{const token=await this.accessToken(),config=getAppleAdsConfiguration();const response=await fetch(`${config.apiBaseUrl}/reports/campaigns/${campaignId}/searchterms`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"X-AP-Context":`orgId=${organizationId}`,"Content-Type":"application/json"},body:JSON.stringify({startTime:startDate,endTime:endDate,timeZone:"ORTZ",returnRowTotals:true,returnGrandTotals:false,returnRecordsWithNoMetrics:false,selector:{orderBy:[{field:"impressions",sortOrder:"DESCENDING"}],pagination:{offset:0,limit:1000}},groupBy:["countryOrRegion"]}),cache:"no-store"});const raw=await response.json().catch(()=>null) as Record<string,unknown>|null;if(!response.ok)throw new Error(safeMessage(response.status,raw));return {raw:raw??{}};}
  private async listKeywordLike(orgId: string, path: string, adGroupId: string): Promise<AppleAdsKeyword[]> { const rows = await this.list(orgId, path); return rows.map((row) => ({ id: String(row.id), adGroupId: String(row.adGroupId ?? adGroupId), text: String(row.text ?? ""), matchType: typeof row.matchType === "string" ? row.matchType : null, status: typeof row.status === "string" ? row.status : null, servingStatus: typeof row.servingStatus === "string" ? row.servingStatus : null, bidAmount: typeof (row.bidAmount as { amount?: unknown } | null)?.amount === "string" ? (row.bidAmount as { amount: string }).amount : null, currency: typeof (row.bidAmount as { currency?: unknown } | null)?.currency === "string" ? (row.bidAmount as { currency: string }).currency : null, modificationTime: typeof row.modificationTime === "string" ? row.modificationTime : null, deleted: row.deleted === true, rawPayload: row })); }
  private async list(organizationId: string, path: string): Promise<Array<Record<string, unknown>>> { const token = await this.accessToken(); const config = getAppleAdsConfiguration(); const all: Array<Record<string, unknown>> = []; for (let offset = 0; ; offset += 1000) { const response = await fetch(`${config.apiBaseUrl}${path}?limit=1000&offset=${offset}`, { headers: { Authorization: `Bearer ${token}`, "X-AP-Context": `orgId=${organizationId}` }, cache: "no-store" }); const payload = await response.json().catch(() => null) as { data?: Array<Record<string, unknown>>; pagination?: { totalResults?: number } } | null; if (!response.ok) throw new Error(safeMessage(response.status, payload)); const page = payload?.data ?? []; all.push(...page); if (page.length < 1000 || all.length >= (payload?.pagination?.totalResults ?? 0)) return all; } }

  private async accessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
    const credentials = await this.credentialStore.getAppleAdsCredentials();
    if (!credentials) throw new Error("Apple Ads server credentials are not configured.");
    const form = new URLSearchParams({ grant_type: "client_credentials", client_id: credentials.clientId, client_secret: credentials.clientSecret, scope: "searchadsorg" });
    const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" });
    const payload = await response.json().catch(() => null) as TokenPayload | null;
    if (!response.ok || !payload?.access_token) throw new Error(safeMessage(response.status, payload));
    cachedToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(60, (payload.expires_in ?? 3600) - 60) * 1000 };
    return cachedToken.value;
  }
}
