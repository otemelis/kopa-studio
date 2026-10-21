# AppFollow API v2 feasibility audit

Date: 2026-07-28

## Scope and safety

This was a read-only feasibility audit. No AppFollow write endpoint, database migration, scheduled polling, recurring sync, or browser-exposed token was added. The temporary CLI probe is [appfollow-keywords-audit.mjs](apps/tools/scripts/appfollow-keywords-audit.mjs); it reads `APPFOLLOW_API_TOKEN` only from the server environment and never prints it.

Exactly one AppFollow API request was made. No retry or pagination was performed after the result.

## Existing Kopa mapping

- Kopa app: `InnerType Personality Test`
- App Store / Adam ID: `6785764991`
- Mapping source: `aso_apps` and `apple_ads_app_mappings`

## Country-code verification

AppFollow’s published country-parameter table states that the United Kingdom is `GB`, not `UK`. [AppFollow country and language parameters](https://support.appfollow.io/hc/en-us/articles/360020979578-API-Country-and-Language-Parameters)

However, the API returned `Invalid country GB` for the documented v2 endpoint. This is a direct incompatibility between the public country table and this endpoint/account response. The audit must not infer that `UK` is valid, and did not make a second request to test it.

## Exact tested request

```text
GET https://api.appfollow.io/api/v2/aso/keywords?ext_id=6785764991&country=GB&device=iphone&date=2026-07-26&page=1
Accept: application/json
X-AppFollow-API-Token: [server-side only; omitted]
```

The v2 API reference documents this endpoint, the `ext_id`, `country`, `device`, `date`, and `page` query parameters, and a cost of 10 API credits per request. [Keywords endpoint](https://docs.api.appfollow.io/reference/keywords_api_v2_aso_keywords_get-1)

## Initial UK result

| Item | Finding |
|---|---|
| HTTP status | `422 Unprocessable Entity` |
| Response structure | `{ "detail": [{ "loc": ["query", "country"], "msg": "Invalid country GB", "type": "value_error" }] }` |
| Returned keyword records | `0` |
| Pagination fields | Not returned |
| Quota / credit headers | None returned |
| Available keyword fields | Not returned |
| Token works | Not positively confirmed. The request did not return `401`, but parameter validation may have happened before authorization. |
| Account plan permits endpoint | Not determined. The request did not reach a `200` or `402` response. |

The v2 reference documents `401`, `402`, `422`, and `424` for this method. In this test, `422` is specifically an invalid-parameter outcome, not evidence of an unavailable plan. [Keywords endpoint](https://docs.api.appfollow.io/reference/keywords_api_v2_aso_keywords_get-1)

## Response-field audit

No successful response was available, so no response mappings are claimed below. The “documented” column reflects AppFollow’s public parameter reference only, not a verified v2 response schema. [AppFollow API parameters](https://support.appfollow.io/hc/en-us/articles/360020832317-API-Parameters)

| Kopa need | Documented AppFollow equivalent | Audit status |
|---|---|---|
| Keyword | `kw` | Documented, not observed |
| Country | `country` | Request scope only; not observed in a response |
| Device | `device` | Request scope only; not observed in a response |
| Date | `date` | Request scope only; not observed in a response |
| Current position | `pos` | Documented, not observed |
| Position change | No documented field found for this endpoint | Absent / unverified |
| Best rank | No documented field found | Absent / unverified |
| Popularity | `popularity` | Documented, not observed |
| Difficulty | No documented field found | Absent / unverified |
| Effectiveness / KEI | `score` is documented as a custom account score, not confirmed as KEI | Not equivalent / unverified |
| Estimated search downloads | No documented field found | Absent / unverified |
| Competing apps | No documented field found | Absent / unverified |
| Presence in title | No documented field found | Absent / unverified |
| Presence in subtitle | No documented field found | Absent / unverified |
| App indexing or ranking state | `no_pos` is documented as a request parameter for positions below Top-200, not a verified response field | Unverified |

## Pagination model

The public parameter reference says `page` is a page number and that `prev` and `next` are `NULL` when only one page exists; it also documents `total` as the keyword count after filters. None of these fields was returned by the failed request, so pagination remains unverified for this account/endpoint. [AppFollow API parameters](https://support.appfollow.io/hc/en-us/articles/360020832317-API-Parameters)

## API credit cost and request estimate

The endpoint cost is 10 credits per request. A single first-page request for each requested market would cost:

| Market | Country code to validate before use | Page-1 requests | Minimum credits |
|---|---:|---:|---:|
| UK | `GB` documented, rejected in this test | 1 | 10 |
| US | `US` documented | 1 | 10 |
| Germany | `DE` documented | 1 | 10 |
| Japan | `JP` documented | 1 | 10 |
| Hong Kong | `HK` documented | 1 | 10 |
| Total | — | 5 | 50 |

This is a minimum only. Total records and `next` pagination were not available, so the full-sync request count and cost cannot be estimated without inventing data.

## Data gaps compared with the broken AppFollow export

- No successful v2 payload was obtained, so its columns cannot be compared field-by-field to the old export.
- Current position and popularity are documented but unverified in the response.
- Position change, best rank, difficulty, KEI, estimated search downloads, competing apps, title/subtitle presence, and indexing state have no verified v2 response mapping from this audit.
- No quota header or credit balance was returned.
- The UK country-code contradiction blocks the intended first market.

## Recommended synchronization frequency

Do not schedule synchronization yet. If a later, explicitly authorized validation establishes the valid country code and confirms `200`, begin with manual, page-1-only exports. A weekly market snapshot is the conservative starting point because each request costs credits; do not choose a recurring frequency until the returned page count and available credit allocation are known.

## Recommendation

**Do not build the full integration yet.**

The token is present, but the single permitted request failed parameter validation for the officially documented UK code. Resolve this discrepancy with AppFollow support or the existing AppFollow workspace, then perform one separately authorized successful-response audit to confirm the response fields, pagination, token authorization, and plan/credit availability before designing storage or synchronization.

---

## Follow-up: authorized US request

Date: 2026-07-28

One additional request was explicitly authorized because the existing AppFollow workspace already tracks the United States for InnerType. It used the documented lowercase country example and was not retried or paginated.

```text
GET https://api.appfollow.io/api/v2/aso/keywords?ext_id=6785764991&country=us&device=iphone&date=2026-07-26&page=1
Accept: application/json
X-AppFollow-API-Token: [server-side only; omitted]
```

| Item | Observed result |
|---|---|
| HTTP status | `200 OK` |
| Token authorized | Yes. The endpoint accepted the authenticated request. |
| Plan permits endpoint | Yes for this request. A `200` response was received, not `402`. |
| Sanitized response structure | `{ "keywords": [] }` |
| Returned keyword records | `0` |
| Pagination fields | None returned in the response body |
| Keyword fields | None observed because no keyword record was returned |
| Quota / credit details | No quota or credit headers/body fields returned |

### Observed-field map

Only the top-level `keywords` collection was observed. The requested date/page returned no records, so the following fields are **not** claimed as response mappings: keyword, position, popularity, custom score, date, country, device, total records, previous page, or next page.

### Decision after the US request

The AppFollow token and this API endpoint work for InnerType / US / iPhone. Do not add recurring synchronization yet: the successful response is empty, and neither page size, `total`, `next`, nor item fields were returned.

The appropriate next product step, after separate authorization, is a **manual import only** for already tracked markets:

- `us`
- `de`
- `br`
- `fr`
- `es`
- `jp`
- `kr`
- `hk`
- `pt` or `pl` only after resolving whether the existing workspace label `PO` means Portugal or Poland

Each request costs 10 credits. A minimum one-page pass across these nine market entries would cost 90 credits, but a complete-import estimate is not possible because this response supplied no `total`, `next`, or page size. Do not infer a full cost from the empty response.

### Updated recommendation

**Do not build recurring synchronization yet.** The feasibility result is positive for token and endpoint access, but insufficient for data-model design. First obtain a separately authorized successful request that returns at least one keyword record, then audit the actual item fields and pagination before proposing a manual importer or storage model.

---

## Final field-discovery request: Japan

Date: 2026-07-28

Japan was selected because it is the first priority market in the requested order and the supplied AppFollow Keyword Tracking screenshot shows `Japan` with 15 tracked iPhone keywords for InnerType. The screenshot does not expose the underlying per-keyword API fields; the API request below was the single authorized field-discovery request.

```text
GET https://api.appfollow.io/api/v2/aso/keywords?ext_id=6785764991&country=jp&device=iphone&date=2026-07-26&page=1
Accept: application/json
X-AppFollow-API-Token: [server-side only; omitted]
```

| Item | Observed result |
|---|---|
| HTTP status | `200 OK` |
| Sanitized full response | `{ "keywords": [] }` |
| Returned keyword records | `0` |
| Observed item fields | None; no item was returned |
| Pagination fields | None returned |
| Total count | None returned |
| Position representation | Not observed |
| Popularity representation | Not observed |
| Null / unranked behavior | Not observed; the response is an empty collection rather than a keyword item with a null position |
| Quota / credit details | None returned in headers or body |

## Final conclusion

The endpoint is reachable and authorized, but it does not provide useful keyword records for the available InnerType dataset on the tested complete date, even for the Japan workspace market selected from the visible tracking list. No additional markets were tested and no credits will be spent on retries.

Do not build a manual importer, storage mapping, scheduled synchronization, or recurring polling from this audit. There is no observed item schema, pagination model, total count, or page size from which to create a precise AppFollow-to-Kopa map or a complete request/credit estimate.
