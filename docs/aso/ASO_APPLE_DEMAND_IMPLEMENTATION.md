# Apple keyword demand in ASO Progress

The feature uses the existing Apple Ads Platform API v1 OAuth client. It queries the official Search Term Popularity endpoint for **one tracked app, storefront and complete Sunday–Saturday week**. The owner starts a bounded refresh from ASO Progress; this is deliberately manual for the first release. It never changes an Apple campaign, budget or account setting.

The new `Apple demand` table column displays Apple's `searchPopularity1to100` for the app's Apple genre, country and latest stored week. This is a **relative Apple search-demand score**, not monthly search volume, app ranking, downloads, organic traffic or an AppFollow score. Apple may omit tracked terms. A successful query with no row is stored as `not_reported` and displayed **Unavailable**, never zero. A failed query writes nothing. Ranking source series and App Store Connect acquisition metrics remain separate.

Supported explicit genre mappings: InnerType and LoveType → `LIFESTYLE`; POIS → `HEALTH_FITNESS`; PASSPORT → `TRAVEL`. The refresh rejects unmapped categories, future/incomplete weeks, mismatched Apple responses, duplicate terms, invalid pagination and more than 100 tracked terms in one market. It queries at most ten pages and writes only after every page validates. Each row retains the source, week, country, genre, collection timestamp and request/response SHA-256. The default week follows Apple's Monday 07:00 UTC publication boundary. There is no automatic retry or synthetic fallback.

## Production setup after separate approval

1. Apply `supabase/migrations/20261108000000_aso_apple_keyword_popularity.sql` to the approved Supabase project. It creates only the reporting table/index, enables RLS, revokes `anon` and `authenticated`, and grants table access to `service_role`. Verify there are no client policies and that the existing ASO pages still load.
2. In the **kopa-tools production environment only**, set server-side secrets `APPLE_ADS_V1_CLIENT_ID`, `APPLE_ADS_V1_TEAM_ID`, `APPLE_ADS_V1_KEY_ID`, `APPLE_ADS_V1_PRIVATE_KEY`, and `APPLE_ADS_V1_AD_ACCOUNT_ID`. The existing local mode-600 credential file remains supported. Never put the private key in browser variables, source control, logs or preview environment. The account ID must be present in `/v1/acls` for the read-only API user.
3. Deploy the reviewed app commit. Protected previews can render existing data but `POST /api/aso/apple-popularity` is blocked on Vercel preview to prevent a preview from writing to production.
4. As the signed-in owner, open ASO Progress for an app and a single storefront, then click **Refresh Apple demand**. Reconcile the returned week, tracked/observed/not-reported counts with the stored rows and one direct Apple response. Start with PASSPORT US and `passport`, for which a real `50/100` US/Travel observation was independently returned for the week starting 2026-10-25; do not assume it remains 50 in later weeks.

Rollback: disable the refresh route by reverting the app deployment. Leave the stored reporting rows intact for audit; dropping them is a separate database decision. Refreshes may update a row for the same keyword, genre and Apple week if Apple revises its published result. Missing credentials cause an explicit refresh error without a database write.

The local live proof on 2026-11-08 returned HTTP 200 for US/Travel/`passport`, week 2026-10-25, with `rankInGenre=308`, `searchPopularityInGenre=58`, `searchPopularity1to100=50`, and `searchPopularity1to5=3`. No production keyword rows were written during this implementation.
