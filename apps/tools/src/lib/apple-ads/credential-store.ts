/**
 * The owner-only deployment keeps opaque Apple credentials in server environment
 * variables. Per-tenant encrypted storage can implement this interface later
 * without changing the API adapter.
 */
export type AppleAdsCredentials = { clientId: string; clientSecret: string };

export interface CredentialStore {
  getAppleAdsCredentials(): Promise<AppleAdsCredentials | null>;
}

export class EnvironmentCredentialStore implements CredentialStore {
  async getAppleAdsCredentials(): Promise<AppleAdsCredentials | null> {
    const clientId = process.env.APPLE_ADS_CLIENT_ID?.trim();
    const clientSecret = process.env.APPLE_ADS_CLIENT_SECRET?.trim();
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }
}
