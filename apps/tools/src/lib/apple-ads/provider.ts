export type AppleAdsOrganization = { id: string; name: string; currency?: string; timezone?: string };
export type ConnectionResult = { ok: boolean; message: string; organizations: AppleAdsOrganization[] };
export type AppleAdsCampaign = { id: string; adamId: string; name: string; status: string; servingStatus: string | null; biddingStrategy: string | null; dailyBudgetAmount: string | null; currency: string | null; countriesOrRegions: string[]; startTime: string | null; endTime: string | null; modificationTime: string | null; deleted: boolean; rawPayload: Record<string, unknown> };
export type AppleAdsAdGroup = { id: string; campaignId: string; name: string; status: string; servingStatus: string | null; defaultBidAmount: string | null; currency: string | null; searchMatchEnabled: boolean | null; modificationTime: string | null; deleted: boolean; rawPayload: Record<string, unknown> };
export type AppleAdsKeyword = { id: string; adGroupId: string; text: string; matchType: string | null; status: string | null; servingStatus: string | null; bidAmount: string | null; currency: string | null; modificationTime: string | null; deleted: boolean; rawPayload: Record<string, unknown> };
export type AppleAdsCampaignReport={raw:Record<string,unknown>};
export type AppleAdsSearchTermReport={raw:Record<string,unknown>};

/**
 * The Lab depends on this narrow adapter, not directly on Apple endpoint paths.
 * Write operations deliberately do not belong here until the approval-copilot
 * milestone has passed its safety review.
 */
export interface AppleAdsProvider {
  testConnection(): Promise<ConnectionResult>;
  listOrganizations(): Promise<AppleAdsOrganization[]>;
  listCampaigns(organizationId: string): Promise<AppleAdsCampaign[]>;
  listAdGroups(organizationId: string, campaignId: string): Promise<AppleAdsAdGroup[]>;
  listKeywords(organizationId: string, campaignId: string, adGroupId: string): Promise<AppleAdsKeyword[]>;
  listNegativeKeywords(organizationId: string, campaignId: string, adGroupId: string): Promise<AppleAdsKeyword[]>;
  fetchCampaignReport(organizationId:string,campaignId:string,startDate:string,endDate:string):Promise<AppleAdsCampaignReport>;
  fetchSearchTermReport(organizationId:string,campaignId:string,startDate:string,endDate:string):Promise<AppleAdsSearchTermReport>;
}
