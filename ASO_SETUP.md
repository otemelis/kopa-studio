# Kopa ASO: App Store Connect setup

The ASO console uses a team App Store Connect API key for first-party data.
The private key is used only in Vercel server functions and must never be
placed in `src/`, Supabase, or a browser-accessible environment variable.

## Vercel environment variables

Add these to Production, Preview, and Development as appropriate:

```text
APP_STORE_CONNECT_ISSUER_ID=<Issuer ID from Users and Access / Integrations>
APP_STORE_CONNECT_KEY_ID=<Key ID>
APP_STORE_CONNECT_PRIVATE_KEY=<contents of AuthKey_XXXXXXXXXX.p8>
```

Vercel accepts the private key as a multiline value. A value containing literal
`\n` escapes also works. Use a team key with the narrowest App Store Connect
role that can read apps and Sales and Trends data; individual keys cannot read
Sales and Finance data.

After deployment, open the private Kopa console, choose ASO, then Sync, and
use **Test connection**. A successful test records the connection status and
matches Kopa's tracked iOS apps to App Store Connect apps by bundle ID.

The next ASO milestone uses those stored App Store Connect ids to import daily
first-party metrics into `aso_daily_metrics`.
