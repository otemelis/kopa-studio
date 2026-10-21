export type AppleAdsConfiguration = {
  configured: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  attributionSecretConfigured: boolean;
  apiBaseUrl: string;
};

const defaultApiBaseUrl = "https://api.searchads.apple.com/api/v5";

export function getAppleAdsConfiguration(): AppleAdsConfiguration {
  const clientIdConfigured = Boolean(process.env.APPLE_ADS_CLIENT_ID?.trim());
  const clientSecretConfigured = Boolean(process.env.APPLE_ADS_CLIENT_SECRET?.trim());
  const attributionSecretConfigured = Boolean(process.env.APPLE_ADS_ATTRIBUTION_SECRET?.trim());
  return {
    configured: clientIdConfigured && clientSecretConfigured,
    clientIdConfigured,
    clientSecretConfigured,
    attributionSecretConfigured,
    apiBaseUrl: process.env.APPLE_ADS_API_BASE_URL?.trim() || defaultApiBaseUrl,
  };
}
