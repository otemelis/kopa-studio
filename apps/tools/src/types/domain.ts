export type Role = "owner" | "admin" | "viewer";

export type DataSource = "public_store" | "appstore_connect" | "calculated" | "rules";

export interface AsoApp {
  id: string;
  name: string;
  platform: "ios" | "android";
  storeAppId: string;
  bundleId: string | null;
  primaryCountry: string;
  category: string | null;
  rating: number | null;
  ratingCount: number | null;
  updatedAt: string;
  lastStoreUpdateAt: string | null;
}

export interface OverviewMetrics {
  appCount: number;
  activeKeywords: number;
  activeInsights: number;
  lastCollectionAt: string | null;
}

export interface SyncRun {
  id: string;
  provider: string;
  trigger: "manual" | "cron";
  status: "running" | "ok" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
  processed: number;
  succeeded: number;
  failed: number;
  error: string | null;
}

export interface KeywordRow {
  linkId: string;
  appId: string;
  appName: string;
  term: string;
  country: string;
  priority: "high" | "medium" | "low";
  status: "active" | "paused";
  rank: number | null;
  change7d: number | null;
  change30d: number | null;
  bestRank: number | null;
  metadataPresence: "title" | "subtitle" | "missing" | "unknown";
  adsStatus: "exact" | "broad" | "both" | "negative" | "inactive" | "none";
  capturedAt: string | null;
}

export interface InsightRow {
  id: string;
  appName: string | null;
  title: string;
  observation: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  confidence: string;
  impact: string;
  effort: string;
  ruleId: string;
  createdAt: string;
}

export interface RankingHistoryRow {
  keyword: string;
  country: string;
  capturedOn: string;
  rank: number | null;
  change7d: number | null;
}

export interface CompetitorRow {
  id: string;
  name: string;
  appId: string;
  appName: string;
  rating: number | null;
  version: string | null;
  capturedAt: string | null;
}

export interface StorefrontRow {
  id: string;
  appId: string;
  appName: string;
  country: string;
  isPrimary: boolean;
  metadataLocalised: boolean;
  screenshotsLocalised: boolean;
  screenshotUiState: "localized" | "english" | "unknown";
  appLanguageState: "localized" | "english" | "unknown";
  keywordsTracked: number;
  hasAscData: boolean;
  appleAdsActive: boolean;
  readiness: string;
  notes: string | null;
}

export interface AppStoreConnectStatus {
  status: "unconfigured" | "configured" | "error";
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastSyncAt: string | null;
  reportRequests: Array<{ appName: string; status: string; lastCheckedAt: string | null; lastError: string | null }>;
}

export type ExperimentStatus = "planned" | "running" | "monitoring" | "won" | "lost" | "inconclusive" | "reverted";
export interface ExperimentRow { id: string; appId: string; appName: string; title: string; hypothesis: string | null; changeType: string; country: string; targetMetric: string; startDate: string | null; status: ExperimentStatus; result: string | null; conclusion: string | null; nextAction: string | null; }
