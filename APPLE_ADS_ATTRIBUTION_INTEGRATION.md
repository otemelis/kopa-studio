# Apple Ads attribution integration

The ingestion endpoint is available at `POST https://tools.kopa.studio/api/apple-ads/attribution`. Each iOS app should obtain Apple’s AdServices attribution token on-device, send it to its own trusted app backend for validation/normalization, then forward only the allowed attribution identifiers to this endpoint. Authenticate the final server-to-server call with `Authorization: Bearer <APPLE_ADS_ATTRIBUTION_SECRET>`.

Required body fields are `appId`, a rotating anonymous `installationKey`, and `payload`. Optional fields are `campaignId`, `adGroupId`, `keywordId`, `adId`, and `attributionState`. Never send IDFA, device fingerprints, Apple account details, or the server secret from the app client. Existing product events should refer to the anonymous installation key rather than copy attribution data.
