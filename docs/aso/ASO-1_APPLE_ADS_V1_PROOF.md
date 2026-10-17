# ASO-1: Apple Ads Platform API v1 proof

**Verified:** 17 October 2026, 18:49 UTC

**Environment:** local development branch `codex/kopa-milestones-2026-10-15`

**API:** `https://api.ads.apple.com/v1`
**Effect:** read-only. Requests were limited to `GET /me`, `GET /acls`, and the two documented `/query` endpoints. No campaign, budget, keyword, account, or App Store state was changed.

## Authentication and permissions

The client creates an Apple ES256 client-secret JWT from the local private key, exchanges it for a bearer token using the `client_credentials` grant and `searchadsorg` scope, then keeps the access token in memory only. The private key and credential identifiers are outside the repository. The live calls succeeded, so the uploaded key, client/team/key identifiers, signature and OAuth exchange were accepted by Apple.

| Call | HTTP | Observed result |
| --- | ---: | --- |
| `GET /v1/me` | 200 | `orgId=23026890`; authenticated user returned |
| `GET /v1/acls` | 200 | `adAccount.id=23026890`, same `orgId`, role string `API Read Only` |

The selected account context was `X-AP-Context: adAccountId=23026890`. Both keyword query endpoints returned HTTP 200 under this context. The exact live ACL role is `API Read Only`; Apple’s role reference describes read-only reporting roles, including `API Account Read Only` and the limited-access `API Read Only` role. The API response confirms effective read access but does not establish which UI grouping/label was selected.

Apple documents `/v1/me` and `/v1/acls` as unscoped. Account-scoped calls require the `adAccountId` context. The live `orgId` and ACL account ID match, and the popularity and suggestions calls succeeded with that account ID.

## Search Term Popularity

The live request used country `US`, genre `HEALTH_FITNESS`, weekly UTC aggregation, and the interval 13 July 2025 through 10 October 2026. Two exact Sunday week boundaries were selected for a compact history check: `2025-07-13` and `2026-10-04`.

The POIS query used exact terms (`POIS`, `post orgasmic illness`, `post-orgasmic illness syndrome`, and `postorgasmic illness syndrome`) and returned HTTP 200 with zero rows. A separate case-insensitive `CONTAINS` query for `orgasmic` also returned zero rows. A `CONTAINS` query for `personality` returned zero rows. These are **no matching Apple rows**, not a zero search-volume score and not evidence that demand is absent.

To validate the schema and historical data independently of those empty term filters, the query requested `18 birdies` for both selected weeks. Apple returned exactly two rows:

| US / Health & Fitness week | `rankInGenre` | `searchPopularityInGenre` (1–100) | `searchPopularity1to100` | `searchPopularity1to5` |
| --- | ---: | ---: | ---: | ---: |
| 2025-07-13 | 13 | 86 | 65 | 4 |
| 2026-10-04 | 59 | 80 | 59 | 3 |

This confirms the API returns historical, country/genre-scoped popularity observations and all four requested fields. These values describe Apple’s relative search popularity; they are not absolute query counts, InnerType/POIS organic rankings, downloads, or keyword attribution. The broader two-week response returned 500 rows for each selected week; the response had `offset` and `pageSize` but no `totalCount`, so that broader response alone does not prove catalog completeness.

## Keyword Suggestions

The app-scoped query used InnerType’s App Store ID `6785764991` and country `US`; it returned HTTP 200 and `pagination.totalCount=300` (first 100 returned). The leading unseeded results included `instagram` (100), `x` (100), `tik tok` (96), `facebook` (95), and `reddit` (94). The API is reachable and app-scoped, but this sample is weakly aligned with InnerType’s personality-test purpose and should not be treated as a validated opportunity list.

A second query seeded with `personality test`, `personality quiz`, and `personality` returned one row: `personality test`, popularity `5`, `totalCount=1`. The popularity field is a relative suggestion score, not an organic rank or search-volume count.

Apple’s docs recommend sorting suggestions by `popularity DESC`. The live API rejected that request with `VALIDATION_ERROR: INVALID_FIELD_ATTRIBUTE sorting[0].popularity Field 'popularity' is not queryable`. The adapter omits this optional sort; the observed unsorted request returned rows in descending popularity order, but that ordering should not be assumed until verified on further responses.

## History, countries and rate limits

Apple documents `WEEKLY_SUN_SAT` history with a rolling 65-week retention and `MONTHLY` history with 15-month retention; weekly reports are generated Mondays at 07:00 UTC and monthly reports refresh on the 5th UTC. Live data was confirmed for the two queried weeks, including the older July 2025 period. Live popularity queries returned 200 with rows for `US`, `DE`, and `GB` in `HEALTH_FITNESS`; the bounded DE and GB checks each returned 10 rows for week `2026-10-04`. The US market was also accepted by Keyword Suggestions. Apple documents country/region filters using country codes; this proof does not establish an exhaustive market list.

Observed `RateLimit-*` response headers were:

| Endpoint group | Observed limit | Example remaining/reset |
| --- | ---: | --- |
| `/me`, `/acls` | 200 | 199 / 1 second |
| Search Term Popularity | 5 | 3–5 / 1 second |
| Keyword Suggestions | 200 | 199–200 / 1 second |

These are the live headers observed during this run, not permanent quotas. The client returns limit, remaining, reset and retry-after headers with each response. Apple’s docs say to pace requests using these headers and honor `Retry-After` after a 429.

## Reproducibility and evidence

The live test is gated so routine test runs do not contact Apple. Run from `apps/tools` with the credential file and account ID set locally:

```sh
KOPA_APPLE_ADS_V1_LIVE_CHECK=1 \
APPLE_ADS_V1_CREDENTIALS_PATH="/Users/otastemelis/Library/Application Support/Kopa/Apple Ads API/credentials.json" \
APPLE_ADS_V1_AD_ACCOUNT_ID="23026890" \
APPLE_ADS_V1_PROBE_OUTPUT="/private/tmp/kopa-apple-ads-v1-live.json" \
npm test -- --run src/lib/apple-ads/apple-ads-v1-live-check.test.ts
```

The output contains response status/timestamps, pagination, rate-limit headers, result samples, and SHA-256 hashes for the request (excluding bearer credentials) and raw response. It is written outside the repository with owner-only permissions. No token, client secret, or private key is written to the output.

The sanitized live response evidence is stored at `/Users/otastemelis/Library/Application Support/Kopa/Apple Ads API/read-only-verification-2026-10-17.json` (mode `600`), outside the repository. The `18 birdies` history query returned request SHA-256 `21c93bb85d0d612a7a353a52dde7ad39c6c98d3edbfe884b8f52510ba60ccace` and response SHA-256 `b40000d7dffcbf67b03ffac3264e87659abaae0b71a2ccdae98e0ced0633b6d3`. The unseeded suggestions query returned request SHA-256 `1edaed7bbcf95693c47a273e82bb630adddb28cdad2f84f8d42c4e1f2de204d9` and response SHA-256 `6b7e6bdda776fe514476c8cbd630d93dd9939528d513c38002b94669f072e088`.

## Conclusions and next steps

- **Verified:** ES256 OAuth works; the user can read `/me`, `/acls`, Search Term Popularity, and app-scoped Keyword Suggestions for account `23026890`.
- **Verified:** US Health & Fitness has Apple popularity observations for old and recent weeks; the API returned genre rank and all three popularity scales.
- **Unavailable in this sample:** no matching POIS/orgasmic term rows. Keep these terms unavailable rather than assigning zero popularity.
- **Not yet established:** exhaustive historical catalog coverage, all supported storefronts, no-campaign eligibility, and a useful InnerType suggestion set. The active account has a campaign, so a no-campaign prerequisite cannot be empirically tested without a separate existing no-campaign account.
- **Recommended:** preserve these two Apple data types as distinct from organic rank. Continue to the roadmap’s organic-rank method gate, and separately validate Apple suggestions against metadata/app relevance before using them for opportunity scoring. No migration or dashboard is justified by this proof alone.

## Official references

- [OAuth implementation](https://developer.apple.com/documentation/apple-ads-platform-api/implementing-oauth-for-the-apple-ads-platform-api)
- [API access and account context](https://developer.apple.com/documentation/apple-ads-platform-api/access-overview)
- [Apple Ads ACL roles](https://developer.apple.com/documentation/apple_ads/useracl)
- [Search Term Popularity Query](https://developer.apple.com/documentation/apple-ads-platform-api/query-app-search-term-popularity-data)
- [Popularity history window](https://developer.apple.com/documentation/apple-ads-platform-api/searchtermpopularitytimerange)
- [Keyword Suggestions](https://developer.apple.com/documentation/apple-ads-platform-api/query-keyword-suggestions)
- [Rate limits](https://developer.apple.com/documentation/apple-ads-platform-api/rate-limits)
