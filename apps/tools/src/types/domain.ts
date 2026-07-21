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
