# Current activation update · 17 October 2026, 12:38 UTC

Three owner-approved ONGOING Analytics requests are active for POIS, PASSPORT and LoveType; existing reporting-key access verified. The nine required report types have no daily instances at the activation check. The refreshed CSV therefore retains 420 blank Analytics cells as unavailable_analytics_pending_validation, not zeros. The existing Sales refresh remains functional: 2,184 rows, 78 reconciled series, 1,204 independently checked daily values and three weekly controls. Numeric totals and period (16 September–13 October) match the checkpoint below. Latest manifest hash: `cd72a0c84418fcb8ee4f395dd9e9a121eaec021e29f90ba8344304303ca4b870`. Last successful refresh: 2026-10-17T12:38:30.594745+00:00. No historical request, app release or new permission was created.

The earlier checkpoint below is preserved as historical evidence of the state before approved activation. Current operational metadata always comes from current.json.

---

# M4 four-app official Sales coverage · 17 October 2026

The existing overview at http://127.0.0.1:4340/ now reads validated official Apple Sales rows for all four known apps. Existing Signal layout and appearance controls are retained. Run `npm run reports:refresh` then reload; no server restart or production deployment is needed.

Current snapshot: **16 September–13 October 2026**, all territories, last successful refresh **17 October 11:07:17 UTC**. The common cutoff remains the earlier of latest available InnerType processing date minus three days and current UTC date minus three days; it is a conservative report-completion policy, not a promise that all Apple data through yesterday exists.

| App | First-time Sales app units | Paid positive IAP units | Estimated proceeds |
|---|---:|---:|---|
| InnerType | 58 | 4 | GBP 2.89 and USD 16.80 separately |
| LoveType | 10 | 0 | No revenue-bearing rows; no currency invented |
| POIS | 0 | 0 | No matching Sales rows in this historical window |
| PASSPORT | 0 | 0 | No matching Sales rows in this historical window |

POIS/PASSPORT zeros describe matching rows in complete official Sales responses, not current launch status, customers or production telemetry. All four apps were identified against Apple's app catalog by exact Apple ID and SKU. No report request was created. LoveType, POIS and PASSPORT have empty Analytics request lists: impressions, page views and source breakdowns remain unavailable, not zero. Other account apps stay outside this portfolio, but are retained in account-wide weekly reconciliation controls.

Validation: 82 Analytics segments checksum-verified; 28 daily Sales responses (24 successful files, four explicit Apple no-sales responses); three complete weekly controls spanning 21 days. All 78 series / 2,184 daily records reconcile. Independent SQLite checks 1,204 available daily values and 12 weekly dimension groups; boundary days retain daily raw-source checks only. Independent browser/CSV verification matches all 118 visible values in 7/28-day views. Sixteen regression tests plus the corrupt-publication test pass. Original accepted two-app CSV remains an unchanged regression fixture. Test fixtures are confined to tests and never published.

InnerType Analytics reports 57 first downloads on UTC dates versus 58 Sales app units on Pacific dates. These remain separate definitions/date boundaries; no forced reconciliation or cross-source user funnel. Purchase aggregates match their own sources. Proceeds retain currencies, not a converted or settled total.

Live product reads remain independent: on 17 October POIS still has no App Store-tagged telemetry; observed TestFlight activity is not customer behavior. PASSPORT has no qualifying product rows. No launch day, cohort, retention or anomaly is inferred from official Sales zeros or TestFlight. M4's local capability is ready; actual launch-evidence acceptance remains pending.

PASSPORT build 1.0.1 (2) is now confirmed VALID / INTERNAL_ONLY by Apple. Owner postponed device tests until next week; installation, genuine upload and hosted retry validation remain pending. No release changes were made in this checkpoint.

Next approval-dependent step: enable ongoing Apple Analytics reporting for POIS, PASSPORT and LoveType. Reviewed request bodies are in ANALYTICS_REQUESTS_PENDING_APPROVAL.json. Until approved, no POSTs or account changes. After generation, extend the existing extraction mapping and validate actual date coverage before publishing; the current refresh fails safely if a new request appears unexpectedly. Historical ONE_TIME_SNAPSHOT requests remain separate and are not included in that approval.

---

## Original accepted baseline (historical regression evidence)

# Portfolio baseline · verified 15 October 2026

Canonical local entry point: run `npm run portfolio` from the Kopa milestone branch, then open http://127.0.0.1:4340/. This retains the accepted Signal layout and themes. It is a historical official-report snapshot, refreshed manually with `npm run reports:refresh`; it is not a live telemetry dashboard.

The current manifest's source covers 14 September–11 October 2026. Its last successful refresh is 15 October, 13:05 UTC. The source was independently checked against 84 Apple Analytics segments, 28 daily Sales responses, four weekly controls, all 52 report series and 1,036 available daily values. InnerType: 54 first-time downloads, 2,033 icon impressions, 153 product-page views, four paid IAP units, USD 16.80 plus GBP 2.89 estimated proceeds. LoveType: ten first-time downloads, zero paid IAP units; Analytics unavailable.

The original accepted daily CSV remains a regression fixture. Metric definitions retain UTC Analytics versus Pacific Sales, original currencies, and blank unavailable values. No synthetic fallback exists. POIS/PASSPORT remain placeholders on this baseline page until the separate Product Analytics milestone qualifies their sources.

The overview now shows the last complete data date, last attempt, last successful refresh and stale/failed source status. Failed attempts atomically update only refresh-status.json and leave current.json/data untouched. Stale snapshots remain explicitly labelled. Missing operational metadata is unavailable, never inferred successful. A hash or data-load failure hides metrics entirely.

Development validation: eleven reporting tests (eight baseline calculation/integrity checks, three freshness-state checks), Python compile checks and the prior independently verified manual refresh. Details and milestone status live in docs/KOPA_ROADMAP.md and STATUS.md in the repository. LoveType Analytics request creation still requires owner approval; its exact steps remain in LOVETYPE_ANALYTICS.md. No scheduler was enabled and no production state changed.
