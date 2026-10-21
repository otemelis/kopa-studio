# M6 · Read-only access preflight · 15 October 2026

Existing Supabase history contains three Apple Ads campaigns and 46 daily metric rows, all mapped to InnerType. The connection record says read_only/healthy with last successful API/full sync 12 October 17:21 UTC. Account timezone/currency fields are null, while campaign currencies are EUR. One campaign was recorded running at that sync, one paused, one enabled/not running. These are **stored historical states**, not verified current campaign or spending status. Campaign metrics span 20 July–12 October; rows are not assumed to constitute a complete daily series or a reconciled spend total.

Checked local `.env.local` files contain no APPLE_ADS_CLIENT_ID/SECRET. Example files are not credentials. The existing app runtime reader is intentionally restricted to product tables; its grants were not expanded. No provider call, token generation, campaign mutation, permission grant or new integration occurred.

Next input: an official daily Apple Ads campaign CSV export for a known bounded period (including account currency, reporting timezone, campaign ID, impressions, taps, spend and separately defined attributed downloads), or a path to an existing authorized read-only credential file. First reconcile one campaign/day against stored data before building a reporting page. An App Store Connect key is not an Apple Ads credential.

Current official [Apple Ads Platform API access instructions](https://ads.apple.com/app-store/help/campaigns/0022-use-the-apple-ads-platform-api) describe a designated API user and API Account Read Only/API Read Only roles. [Current API documentation](https://developer.apple.com/documentation/apple-ads-platform-api/calling-apple-ads-platform-api) uses Platform API v1, so the retained v5 adapter remains reference code rather than a blindly reusable current integration. Do not create users/clients or modify roles without approval. No need to buy a service for the initial official export reconciliation.

## Simplest owner export

1. Sign in at https://ads.apple.com/ and open Campaigns for InnerType.
2. Set start/end both to **11 October 2026**. Include paused campaigns and all countries. This day has a stored metric row and predates the last sync, avoiding its incomplete day.
3. Include Campaign ID/name, Spend, Impressions, Taps, Installs (Tap-Through), Installs (Total), New Downloads and Redownloads where available. Preserve attribution variants in their original headings.
4. Download the campaign table CSV to Downloads and provide its local path.
5. Provide the reporting timezone/currency shown by Apple Ads if absent from the file. Do not change the account timezone merely to produce this control.

One day gives the first daily reconciliation without an API key. See the official [dashboard reporting guide](https://ads.apple.com/app-store/help/reporting/0024-view-campaigns-dashboard-metrics). Later reports may revise attributed outcomes; reconciliation will retain export time and explain differences rather than overwriting history to force a match.
