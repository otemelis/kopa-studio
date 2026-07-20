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
APP_STORE_CONNECT_VENDOR_NUMBER=<vendor number from Sales and Trends>
APP_STORE_CONNECT_SETUP_ISSUER_ID=<temporary Admin key issuer ID>
APP_STORE_CONNECT_SETUP_KEY_ID=<temporary Admin key ID>
APP_STORE_CONNECT_SETUP_PRIVATE_KEY=<temporary Admin key .p8 contents>
```

Vercel accepts the private key as a multiline value. A value containing literal
`\n` escapes also works. Use a team key with the narrowest App Store Connect
role that can read apps and Sales and Trends data; individual keys cannot read
Sales and Finance data. Apple's Analytics Reports API calls this report-reading
role **Sales and Reports**; create a new team key with that role if the current
key receives a 403 when syncing reports.

The three `APP_STORE_CONNECT_SETUP_*` values are a separate, temporary team
key with the **Admin** role. Kopa uses it only when you press **Request
report** to create the ongoing App Store Discovery and Engagement request.
After that, remove the temporary Admin key from Vercel; the regular Sales and
Reports key is sufficient for daily report downloads. Apple can take 1-2 days
to begin generating the first report. The report supplies product-page views,
discovery impressions, source types, and territories, but Apple does not
provide the exact search terms users entered.

After deployment, open the private Kopa console, choose ASO, then Sync, and
use **Test connection**. A successful test records the connection status and
matches Kopa's tracked iOS apps to App Store Connect apps by bundle ID.

The sales importer downloads Apple's latest available daily Summary Sales
report, which is generally available the following day. It records downloads
and proceeds by tracked app and country. To enable it, add your vendor number
from App Store Connect's Sales and Trends reporting area as
`APP_STORE_CONNECT_VENDOR_NUMBER`.
