# ASO-5 — Organic Ranking Data Proof

**Review date:** 17 October 2026  
**Decision:** Do not buy or connect a ranking provider yet. Appfigures is the lowest-cost ongoing candidate verified, while AppTweak has the strongest documented observation contract. Neither is currently cleared for Kopa ingestion and long-term storage without provider confirmation. Organic rank remains unavailable until a provider proof returns real observations and its rights are confirmed.

## Recommendation

Use Appfigures as the first commercial feasibility candidate because its current Monitor plan is $44.99/month ($35.99/month on annual billing), includes 100 tracked keywords, and advertises daily keyword rank updates. Its `/aso` API returns rank trends for keywords already tracked in the account, with app, country, iOS device and date-range filters. A 10-term InnerType US/DE test should fit the stated keyword allowance if the allowance counts each keyword-market pair as one (Appfigures must confirm this). It is materially cheaper than AppTweak's API Lite at $166/month and richer plans are unnecessary for this proof.

This is a conditional recommendation, not a production approval. Before using Appfigures, obtain written confirmation of: (1) whether rank rows are actual App Store search observations and what storefront/device/language they represent; (2) whether each keyword/date can be distinguished as checked-unranked versus not fetched/no data; (3) rank history lookback and daily refresh timing; (4) whether internal automated API ingestion and indefinite retention of Kopa's own apps' rank records are covered by the current plan and API terms; and (5) how the 100-keyword allowance counts country and device combinations. Its public API returns `position`, but its published per-keyword response does not document the `checked` flag required to distinguish unranked from unavailable. `normalize=true` may fill missing dates; Kopa must request `normalize=false` and never interpret absent dates as unranked.

If Appfigures cannot provide those answers, AppTweak is the best bounded technical proof candidate. Its current/history API explicitly accepts app, up to five keywords, country, language, iPhone/iPad, and dates, and returns `value` plus `fetch_performed`: ranked, confirmed unranked, and no fetch/data are distinguishable. Its 7-day API trial offers 20,000 credits. A rank datapoint costs 10 credits for the first day and 1 per additional day. However, its API Lite recurring plan is $166/month (200,000 monthly credits); its self-serve terms restrict use to internal business purposes and prohibit compiling databases or building competitive services. Kopa must obtain written confirmation that a private, owner-only, source-attributed history store is permitted before retaining results. The trial is not started.

AppFollow is the cheapest listed UI plan candidate ($19/month billed yearly for ASO; vendor-published plan overview says two apps, 500 keywords and 30 days of history), but API affordability is not established: its keyword-rank API endpoint costs 10 credits/request, and credit allotment/plan access must be checked in the account. The route accepts app external ID, country, device, date and page, but its public schema does not expose language or a documented per-query checked/unranked/no-data state. Current public API docs do not establish daily rank collection frequency or long history. Its general terms prohibit collecting service content for commercial use in one's own name without express written consent; get API-specific written ingestion and retention rights. AppFollow therefore stays optional for benchmark evidence and is not the first proof choice.

**Cheapest reliable outcome:** unknown until provider answers rights and missingness questions. Appfigures has the lowest *known* ongoing price that appears sufficient for an owner-only daily sample. If it cannot prove three-state coverage and retention, it is not reliable enough for Kopa's requirement. Do not substitute AppTweak's `effective_value` (including sentinel 501 or interpolated values) for `value`.

## Provider comparison

| Provider | Current verified access and price | Scope and refresh/history | Observation reliability | Kopa storage/use rights |
|---|---|---|---|---|
| **Appfigures** | Monitor: $44.99 monthly or $35.99/month annual; 100 keywords. API docs state 1,000 requests/day/account. API rank data requires the term to be tracked. | `/aso`: one app and one country per call; iOS `handheld`/`tablet`; daily or hourly depending on plan; date range and pagination. Rank is `position`; `normalize` can materialize missing dates. Language is not a documented filter. Country codes are accepted, but the ASO endpoint page does not publish the rank-coverage list. | Rank history is documented, but no per-keyword fetch status is documented; aggregate stats include unranked count. History lookback not stated in endpoint docs. | API terms permit internal/private use and indefinite local retention of private data for products directly owned; terms are dated 2016 and also require a commercial license for commercial use and forbid use that competes with Appfigures. Obtain current written interpretation for Kopa's use. |
| **AppTweak** | API Lite: $166/month, 200K monthly credits; 7-day trial with 20K credits. Rank: 10 credits/app/keyword for first day, 1 per extra day. | Current/history: up to five apps and five keywords per request; explicit country, language and iPhone/iPad; country/language lists are API-provided; historical API price is per day. Plan advertises 110+ iOS countries, 40+ languages, 10 years of API history. API docs do not guarantee a particular refresh time for every requested country/language. | Best public contract: raw `value` + `fetch_performed` reliably maps ranked/unranked/no-fetch. Do not use `effective_value`, which may use sentinel or interpolation. | Self-serve terms limit use to internal purposes and prohibit compiling databases or building competitive services. Permission to persist provider results in Kopa is unresolved and requires written confirmation. |
| **AppFollow** | ASO plan advertised at $19/month billed yearly, 2 apps/500 keywords/30 days; endpoint is 10 credits/request. Exact API credit access/allotment depends on plan/account. | `/api/v2/aso/keywords`: app ID, country, device, date, page. Public endpoint docs accept a country code but do not list rank-country coverage, declare language or refresh cadence; plan overview says 30-day ASO history. | Public endpoint schema is sparse; no documented per-keyword fetch flag or history depth guarantee for API. | Current terms prohibit commercial collection from its service without express written consent. API-specific automated ingestion and retention rights are not established. |

Prices are USD as displayed on the official pages at review time, before tax; annual prices are monthly equivalents and require annual commitment. Vendor plan/access pages change; reconfirm before authorization. A plan price alone does not establish that API calls or retained data are permitted.

## Observation contract

The local provider-neutral foundation is `apps/tools/src/lib/aso/ranking-provider.ts`. Each record carries:

`appStoreId`, exact `keyword`, `country`, requested and effective language (effective language stays null unless the provider states it), language evidence (`explicit`, `provider_default`, or `unknown`), `device`, `observedAt`, `retrievedAt`, `provider`, provider row ID where supplied, granularity, result depth, a state, and a nullable position.

- `ranked`: a provider explicitly confirms a store check and returns a positive integer position.
- `unranked`: a provider explicitly confirms a store check and returns no position.
- `unavailable`: no fetch, provider failure, ambiguous response, or missing observation. No position is stored.

There is no synthetic rank 101/501, no carry-forward, interpolation, or gap fill. `observedAt` is the provider's represented observation time; `retrievedAt` is when Kopa received it. If a provider lacks effective language, Kopa preserves the requested language and records effective language as unknown. Country is the storefront, not user location. Device is the store-search device class. Provider-supplied rank depth must be preserved or left null, never inferred from position.

This milestone adds only a typed interface and its normalizer/tests. It does not add a vendor client, API key, database migration, background job or UI. The current `aso_keyword_rank_snapshots` table and iTunes Search collector remain untouched; legacy catalog positions must not be reinterpreted as organic rankings.

## Minimal live validation after approval

Run one bounded, read-only proof for the published InnerType app, ID `6785764991`, on iPhone in US and Germany. Use five English US terms and five German terms, stored as distinct exact queries:

- US: `personality test`, `personality types`, `personality quiz`, `16 personalities`, `big five personality test`.
- DE: `Persönlichkeitstest`, `Persönlichkeitstypen`, `Persönlichkeitstest App`, `MBTI Test`, `Big Five Test`.

For each query preserve provider language scope, storefront, device, response/fetch state, raw positive position, source date, retrieval time and provider request/row identifiers. First request current values; then request the prior seven complete provider dates to validate history and fill cadence. Persist only after written rights permit it. Re-run the same exact request after 24 hours to test daily refresh stability. POIS is added only when its listing is public and indexed.

The proof passes only if every requested cell is classified as ranked, checked-unranked or unavailable; same-scope repeated retrievals do not rewrite old observations; dates/timezones are explicit; histories reconcile to raw responses; and the provider confirms Kopa's internal automated use and required retention. A missing keyword/date remains unavailable unless the API explicitly reports a completed check with no result.

Manual App Store search comparison is currently gated. The accepted ASO-2 review interprets Apple's Media Services Terms as prohibiting software/device or equivalent manual measurement/monitoring. We did not inspect live search results. Reconsider this comparison only after Apple provides written permission or an authorized search interface; do not scrape, automate native UI, bypass controls or use iTunes order as a substitute.

## Independent collection

No permitted independent collection method has been established. iTunes Search order is catalog search order and is not native organic position. App Store website/native searches are covered by the ASO-2 policy gate. The future path is an Apple-authorized ranking API or licensed vendor with explicit automated access, retention, locale, device and missingness guarantees. This milestone makes no scraping proposal.

## Exact owner input needed to validate real rankings

1. Choose whether to begin with an existing Appfigures account or an AppTweak API trial. No account action has been taken.
2. If Appfigures: confirm the account can track InnerType in US and DE and obtain vendor answers to the five questions in the recommendation above. If AppTweak: authorize the 7-day API trial only after confirming it will not start a paid plan automatically, and obtain written confirmation that Kopa may retain the returned owner-app rank history in its private database.
3. Provide the API credential through a local secret file path or an already-connected provider account; do not paste it into chat. The integration will read it locally/server-side and will never log it.
4. Confirm the ten search phrases above, or provide a replacement list. No App Store operation or purchase is required for this proof.
5. Manual native-search comparison additionally needs Apple's written authorization under the current ASO-2 gate.

## Official sources

- Appfigures: [Keyword Ranks API](https://docs.appfigures.com/api/reference/v2/aso-keyword-ranks), [pricing](https://appfigures.com/platform/pricing), [API limits/public data](https://help.appfigures.com/en/article/appfigures-api-cli-and-mcp-access-limits-and-public-data-1seiibo/), [API terms](https://docs.appfigures.com/api/terms), [API authentication](https://docs.appfigures.com/api/authentication).
- AppTweak: [current keyword ranking API](https://developers.apptweak.com/reference/keyword-metrics-by-app-current), [history API and three-state semantics](https://developers.apptweak.com/reference/keyword-metrics-by-app-history), [API pricing/trial/credits](https://help.apptweak.com/en/articles/6051203-app-store-api-pricing-credits-plans), [current plans](https://www.apptweak.com/en/pricing), [self-serve terms](https://www.apptweak.com/en/legal/terms-of-services).
- AppFollow: [ASO keywords API](https://docs.api.appfollow.io/reference/keywords_api_v2_aso_keywords_get-1), [API overview](https://support.appfollow.io/hc/en-us/articles/360020833017-API-Overview), [plan comparison](https://support.appfollow.io/hc/en-us/articles/360020979798-Choosing-Your-Subscription-Plan), [ASO plan pricing overview](https://appfollow.io/blog/new-plans-at-appfollow-and-how-to-choose-the-right-one), [terms](https://get.appfollow.io/terms).
- Kopa's collection-policy gate: [`ASO-2_ORGANIC_RANK_METHOD_GATE.md`](ASO-2_ORGANIC_RANK_METHOD_GATE.md), existing data source: [`INDEPENDENT_ASO_ROADMAP.md`](INDEPENDENT_ASO_ROADMAP.md).
