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
