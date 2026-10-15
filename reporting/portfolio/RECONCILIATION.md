# Portfolio baseline · verified 15 October 2026

Canonical local entry point: run `npm run portfolio` from the Kopa milestone branch, then open http://127.0.0.1:4340/. This retains the accepted Signal layout and themes. It is a historical official-report snapshot, refreshed manually with `npm run reports:refresh`; it is not a live telemetry dashboard.

The current manifest's source covers 14 September–11 October 2026. Its last successful refresh is 15 October, 13:05 UTC. The source was independently checked against 84 Apple Analytics segments, 28 daily Sales responses, four weekly controls, all 52 report series and 1,036 available daily values. InnerType: 54 first-time downloads, 2,033 icon impressions, 153 product-page views, four paid IAP units, USD 16.80 plus GBP 2.89 estimated proceeds. LoveType: ten first-time downloads, zero paid IAP units; Analytics unavailable.

The original accepted daily CSV remains a regression fixture. Metric definitions retain UTC Analytics versus Pacific Sales, original currencies, and blank unavailable values. No synthetic fallback exists. POIS/PASSPORT remain placeholders on this baseline page until the separate Product Analytics milestone qualifies their sources.

The overview now shows the last complete data date, last attempt, last successful refresh and stale/failed source status. Failed attempts atomically update only refresh-status.json and leave current.json/data untouched. Stale snapshots remain explicitly labelled. Missing operational metadata is unavailable, never inferred successful. A hash or data-load failure hides metrics entirely.

Development validation: eleven reporting tests (eight baseline calculation/integrity checks, three freshness-state checks), Python compile checks and the prior independently verified manual refresh. Details and milestone status live in docs/KOPA_ROADMAP.md and STATUS.md in the repository. LoveType Analytics request creation still requires owner approval; its exact steps remain in LOVETYPE_ANALYTICS.md. No scheduler was enabled and no production state changed.
