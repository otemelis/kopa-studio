import { createHash, createSign } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { safeMessage } from "./apple-ads-provider";

const TOKEN_URL = "https://appleid.apple.com/auth/oauth2/token";
const API_BASE_URL = "https://api.ads.apple.com/v1";
const TOKEN_SCOPE = "searchadsorg";

export type AppleAdsV1Credentials = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

export type AppleAdsV1CredentialStore = { getCredentials(): Promise<AppleAdsV1Credentials | null> };

/** Reads the API user's private configuration from a mode-600 file outside the repository. */
export class FileAppleAdsV1CredentialStore implements AppleAdsV1CredentialStore {
  constructor(private readonly path = process.env.APPLE_ADS_V1_CREDENTIALS_PATH?.trim()) {}

  async getCredentials(): Promise<AppleAdsV1Credentials | null> {
    if (!this.path) return null;
    const parsed: unknown = JSON.parse(await readFile(this.path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (["clientId", "teamId", "keyId", "privateKeyPath"].some((key) => typeof value[key] !== "string" || !(value[key] as string).trim())) return null;
    const keyPath = value.privateKeyPath as string;
    const [keyFile, keyStat] = await Promise.all([readFile(keyPath, "utf8"), stat(keyPath)]);
    if ((keyStat.mode & 0o077) !== 0) throw new Error("Apple Ads private key permissions must be owner-only (0600 or stricter).");
    return { clientId: value.clientId as string, teamId: value.teamId as string, keyId: value.keyId as string, privateKey: keyFile };
  }
}

type AppleAdsTokenResponse = { access_token?: string; expires_in?: number };
type AppleAdsResponse<T> = { result?: T; pagination?: Record<string, unknown> };

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/** Signs Apple's ES256 client-secret JWT. Apple limits client-secret lifetime to less than 180 days. */
export function createAppleAdsClientSecret(credentials: AppleAdsV1Credentials, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: credentials.keyId, typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    sub: credentials.clientId,
    aud: "https://appleid.apple.com",
    iat: nowSeconds,
    exp: nowSeconds + 60 * 60 * 24 * 30,
    iss: credentials.teamId,
  }));
  const signingInput = `${header}.${claims}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: credentials.privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64url(signature)}`;
}

export type AppleAdsV1RateLimit = { limit: string | null; remaining: string | null; resetSeconds: string | null; retryAfterSeconds: string | null };
export type AppleAdsV1Result<T> = {
  result: T;
  pagination: Record<string, unknown> | null;
  status: number;
  requestedAt: string;
  receivedAt: string;
  requestSha256: string;
  responseSha256: string;
  rateLimit: AppleAdsV1RateLimit;
  requestId: string | null;
};

export class AppleAdsApiV1Provider {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly credentialStore: AppleAdsV1CredentialStore = new FileAppleAdsV1CredentialStore()) {}

  async getMe(): Promise<AppleAdsV1Result<Record<string, unknown>>> {
    return this.get("/me");
  }

  async getAcls(): Promise<AppleAdsV1Result<Record<string, unknown>>> {
    return this.get("/acls");
  }

  async querySearchTermPopularity(input: {
    countryOrRegion: string; genre: string; start: string; end: string;
    searchTerms?: string[]; searchTermContains?: string; weeks?: string[]; offset?: number; pageSize?: number;
    searchTermFilter?: { operator: "EQUALS" | "CONTAINS" | "STARTS_WITH"; value: string };
  }): Promise<AppleAdsV1Result<Record<string, unknown>>> {
    const filters: Array<Record<string, unknown>> = [
      { field: "countryOrRegion", operator: "EQUALS", value: input.countryOrRegion },
      { field: "genre", operator: "EQUALS", value: input.genre },
    ];
    if (input.searchTerms?.length) filters.push({ field: "searchTerm", operator: "IN", value: input.searchTerms });
    if (input.searchTermContains?.trim()) filters.push({ field: "searchTerm", operator: "CONTAINS", value: input.searchTermContains.trim() });
    if (input.searchTermFilter?.value.trim()) filters.push({ field: "searchTerm", operator: input.searchTermFilter.operator, value: input.searchTermFilter.value.trim() });
    if (input.weeks?.length) filters.push({ field: "week", operator: "IN", value: input.weeks });
    return this.post("/insights/apps/search-term-popularity/query", {
      filters,
      timeRange: { start: input.start, end: input.end, timeZone: "UTC", granularity: "WEEKLY_SUN_SAT" },
      sorting: [{ field: "week", order: "ASC" }, { field: "searchTerm", order: "ASC" }],
      pagination: { offset: input.offset ?? 0, pageSize: input.pageSize ?? 1000 },
      fields: ["rankInGenre", "searchPopularityInGenre", "searchPopularity1to100", "searchPopularity1to5"],
    });
  }

  async queryKeywordSuggestions(input: { appAdamId: string; countriesOrRegions?: string[]; terms?: string[]; offset?: number; pageSize?: number }): Promise<AppleAdsV1Result<unknown[]>> {
    const filters: Array<Record<string, unknown>> = [
      { field: "promotedObjectId", operator: "EQUALS", value: [input.appAdamId] },
      { field: "promotedObjectType", operator: "EQUALS", value: ["APPSTORE_APP"] },
    ];
    if (input.countriesOrRegions?.length) filters.push({ field: "countriesOrRegions", operator: "IN", value: input.countriesOrRegions });
    if (input.terms?.length) filters.push({ field: "terms", operator: "IN", value: input.terms });
    // Apple documents popularity sorting, but the live API currently rejects it as non-queryable.
    return this.post<unknown[]>("/suggestions/keywords/query", { filters, pagination: { offset: input.offset ?? 0, pageSize: input.pageSize ?? 100 } });
  }

  async queryPhraseSuggestions(input: {
    mode: "SUGGESTION" | "SEARCH";
    appAdamId?: string;
    appType?: "APPSTORE_APP";
    exactPhrases?: string[];
    partialPhrase?: string;
    offset?: number;
    pageSize?: number;
  }): Promise<AppleAdsV1Result<unknown[]>> {
    const filters: Array<Record<string, unknown>> = [{ field: "queryType", operator: "EQUALS", value: [input.mode] }];
    if (input.mode === "SUGGESTION") {
      if (!input.appAdamId) throw new Error("Phrase suggestions require a promoted App Store app ID.");
      filters.push(
        { field: "promotedObjectId", operator: "EQUALS", value: [input.appAdamId] },
        { field: "promotedObjectType", operator: "EQUALS", value: [input.appType ?? "APPSTORE_APP"] },
      );
    } else if (input.exactPhrases?.length) {
      filters.push({ field: "phrase", operator: "IN", value: input.exactPhrases });
    } else if (input.partialPhrase?.trim()) {
      filters.push({ field: "phrase", operator: "LIKE", value: [input.partialPhrase.trim()] });
    } else {
      throw new Error("Phrase search requires exactPhrases or partialPhrase.");
    }
    return this.post<unknown[]>("/suggestions/phrases/query", { filters, pagination: { offset: input.offset ?? 0, pageSize: input.pageSize ?? 100 } });
  }

  async queryCampaignsForApp(appAdamId: string, offset = 0, pageSize = 100): Promise<AppleAdsV1Result<unknown[]>> {
    return this.post<unknown[]>("/campaigns/query", {
      filters: [
        { field: "promotedObjectType", operator: "EQUALS", value: "APPSTORE_APP" },
        { field: "promotedObjectId", operator: "EQUALS", value: appAdamId },
      ],
      pagination: { offset, pageSize, fetchTotalCount: true },
    });
  }

  async queryAppSearchTerms(input: { campaignId: string; start: string; end: string; timeZone?: "ORTZ" | "UTC"; offset?: number; pageSize?: number }): Promise<AppleAdsV1Result<Record<string, unknown>>> {
    return this.post("/reports/apps/searchterms/query", {
      filters: [{ field: "campaignId", operator: "EQUALS", value: input.campaignId }],
      timeRange: { start: input.start, end: input.end, timeZone: input.timeZone ?? "ORTZ", granularity: "DAILY" },
      pagination: { offset: input.offset ?? 0, pageSize: input.pageSize ?? 100 },
    });
  }

  async queryImpressionShare(input: { appAdamId: string; countryOrRegion: string; start: string; end: string; reportType?: "FIRST_SLOT" | "ALL_SLOTS"; offset?: number; pageSize?: number }): Promise<AppleAdsV1Result<Record<string, unknown>>> {
    return this.post("/insights/apps/impression-share/query", {
      filters: [
        { field: "promotedObjectId", operator: "IN", value: [input.appAdamId] },
        { field: "countryOrRegion", operator: "EQUALS", value: input.countryOrRegion },
      ],
      options: { impressionShareReportType: input.reportType ?? "ALL_SLOTS" },
      timeRange: { start: input.start, end: input.end, timeZone: "UTC", granularity: "WEEKLY_SUN_SAT" },
      pagination: { offset: input.offset ?? 0, pageSize: input.pageSize ?? 100 },
    });
  }

  private async get(path: string) { return this.request<Record<string, unknown>>(path); }
  private async post<T = Record<string, unknown>>(path: string, body: Record<string, unknown>) { return this.request<T>(path, body); }

  private async request<T>(path: string, body?: Record<string, unknown>): Promise<AppleAdsV1Result<T>> {
    const token = await this.accessToken();
    const url = `${API_BASE_URL}${path}`;
    const method = body ? "POST" : "GET";
    const requestBody = body ? JSON.stringify(body) : undefined;
    const accountContext = path === "/me" || path === "/acls" ? null : `adAccountId=${await this.getAdAccountId()}`;
    const requestedAt = new Date().toISOString();
    const requestSha256 = createHash("sha256").update(`${method}\n${url}\n${accountContext ?? ""}\n${requestBody ?? ""}`).digest("hex");
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...(accountContext ? { "X-AP-Context": accountContext } : {}) },
      ...(requestBody ? { body: requestBody } : {}), cache: "no-store",
    });
    const responseText = await response.text();
    const receivedAt = new Date().toISOString();
    const responseSha256 = createHash("sha256").update(responseText).digest("hex");
    let payload: AppleAdsResponse<T> | null = null;
    try { payload = JSON.parse(responseText) as AppleAdsResponse<T>; } catch { /* reported below as an invalid envelope */ }
    if (!response.ok) throw new Error(safeMessage(response.status, payload));
    if (!payload || !("result" in payload)) throw new Error("Apple Ads v1 returned an unexpected response envelope.");
    return {
      result: payload.result as T,
      pagination: payload.pagination ?? null,
      status: response.status,
      requestedAt,
      receivedAt,
      requestSha256,
      responseSha256,
      rateLimit: { limit: response.headers.get("RateLimit-Limit"), remaining: response.headers.get("RateLimit-Remaining"), resetSeconds: response.headers.get("RateLimit-Reset"), retryAfterSeconds: response.headers.get("Retry-After") },
      requestId: response.headers.get("X-Request-Id") ?? response.headers.get("Request-Id"),
    };
  }

  private async getAdAccountId(): Promise<string> {
    const id = process.env.APPLE_ADS_V1_AD_ACCOUNT_ID?.trim();
    if (!id) throw new Error("APPLE_ADS_V1_AD_ACCOUNT_ID is not configured; ad-account scoped requests are disabled.");
    if (!/^\d+$/.test(id)) throw new Error("APPLE_ADS_V1_AD_ACCOUNT_ID must contain only digits.");
    return id;
  }

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) return this.cachedToken.value;
    const credentials = await this.credentialStore.getCredentials();
    if (!credentials) throw new Error("Apple Ads v1 credentials are not configured.");
    const form = new URLSearchParams({ grant_type: "client_credentials", client_id: credentials.clientId, client_secret: createAppleAdsClientSecret(credentials), scope: TOKEN_SCOPE });
    const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" });
    const payload = await response.json().catch(() => null) as AppleAdsTokenResponse | null;
    if (!response.ok || !payload?.access_token) throw new Error(safeMessage(response.status, payload));
    this.cachedToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(60, (payload.expires_in ?? 3600) - 60) * 1000 };
    return this.cachedToken.value;
  }
}
