Update · 16 October: the owner provided a successful saved export. Both supplied console overlaps and independent daily reconciliation now pass; see [API_RECONCILIATION.md](API_RECONCILIATION.md). Earlier pending-validation statements below are rollout history.

# Exporter precision defect · 15 October 2026

**Status: corrected production deployment READY; live report reconciliation still pending.** The owner received the endpoint's generic HTTP-error body. No export or zero metrics should be inferred from that response. Live API reconciliation is still incomplete.

## Evidence and root-cause limit

A SELECT-only transaction against retained `public.apple_ads_daily_metrics.raw_payload` found Apple money strings with three/four decimal places. In the requested 17 September–14 October window, examples include 17 September `1.8153`, 20 September `0.2042`, and 21 September `0.6526`, all EUR. The deployed parser's `\d{1,2}` decimal restriction rejects these legitimate retained source values. The new regression failed against the old parser with `Money/currency unavailable`, then passed after the fix.

Apple’s [official campaign report example](https://developer.apple.com/documentation/apple_ads/get-campaign-level-reports) also includes four-decimal monetary strings. These are previously retained daily payloads, not a newly fetched full API response. They establish a definite parser defect relevant to this window; the generic live error cannot establish that it is the only runtime problem. No transaction, revenue, identity or production data was fabricated.

Reproduction query:

```sql
BEGIN READ ONLY;
SELECT metric_date, raw_payload->'localSpend' AS spend, impressions, taps
FROM public.apple_ads_daily_metrics
WHERE raw_payload->'localSpend'->>'amount' <> '0'
ORDER BY metric_date;
COMMIT;
```

## Narrow change

Only the existing four exporter files change: helper, owner-only route and their tests. Accept nonnegative ordinary decimal strings with source precision preserved exactly; do not round to cents or use binary floating point. Negative, exponent, whitespace, missing or nonnumeric money and missing currency remain rejected. Add a safe `failureStage` enum (`provider_request` or `report_validation`) to unsuccessful responses; never return provider exception text, tokens, raw payloads or partial reports. Authentication, SELECT-only database scope, campaign/date bounds and no-substitution behavior remain intact.

Tests: **26 passing** on the development dependencies and the exact production dependency baseline (including precision preservation, malformed-money rejection and separate failure stages). Development typecheck passes. Local production build and preview build both pass. Corrected preview `dpl_FrhHuA8ND7PUnzNX49ETf5wMys9R` is READY; its 308 source hashes match the isolated candidate. All 304 pre-exporter baseline files remain unchanged.

## Next validation

The existing scoped exporter deployment approval covers this bounded correction to the same four files; no new authentication, credentials, permissions, writes or campaign operations were introduced. After corrective production deployment, request the same owner-authenticated 28-day export and independently reconcile the 11 October and 11–14 October console controls. Do not publish the API data into Kopa until that passes. Existing validated CSV page remains unchanged.

## Corrective rollout result

Production `dpl_E5iLpGin26uGRh4km2e58sjrhXnu` is READY and aliased to https://tools.kopa.studio. Local production build, isolated preview build and production build passed. All 308 production source hashes match the corrected isolated candidate: 304 original baseline files unchanged and only the same four exporter files differ from the previous exporter release. Unauthenticated GET still returns 307 to `/login`. No data, permission, credential, UI or campaign changes were made. The first deployment command encountered a transient network failure before changing production; the verified retry succeeded.

Authenticated browser navigation after correction is still blocked by the in-app browser. The owner must reload the same export link and provide the response/file path. This release fixes a proven parser defect, but no successful live export or CSV reconciliation is claimed yet. The accepted CSV snapshot is unchanged.
