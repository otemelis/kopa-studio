# M6 · First official Apple Ads slice · 15 October 2026

**Working manual-export view:** http://127.0.0.1:4340/apple-ads.html. It shows the supplied one-day official campaign report and a separately labeled four-day aggregate. It is not live or automatically refreshable. No Ads API connection, grants, campaign settings or production records changed.

## Reconciliation

| Measure | Official 11 October UTC | Stored campaign 2144366771, 11 October | Result |
|---|---:|---:|---|
| Impressions | 13 | 13 | Numerical match |
| Spend, EUR | 0.00 | 0.00 | Numerical match |
| Taps | 0 | 0 | Numerical match |
| Installs, total | 0 | 0 raw totalInstalls | Numerical match |
| Installs, tap-through | 0 | 0 raw tapInstalls | Numerical match |
| Installs, view-through | 0 | 0 raw viewInstalls | Numerical match |

All three official campaign rows sum exactly to the footer; the footer is not counted as a campaign. Two inactive campaigns are explicit zeros in the official file but **have no stored metric rows** for that day; those missing rows remain absent. Stored account timezone was not persisted. The inspected local legacy report adapter requests UTC, but its deployed request provenance is not independently established. The official file explicitly specifies UTC/EUR. These are numerical matches with a retained timezone provenance caveat, not a declaration that the entire legacy ingestion is validated. Zero attributed outcomes cannot prove nonzero conversion-field mapping is correct.

The first supplied export is 11–14 October UTC: **EUR 0.49, 52 impressions, 1 tap, 0 total/tap/view installs**, all in the UK post-metadata campaign. Stored data supplies 13 impressions on 11 October and 4 on 12 October (synced at 17:21 UTC before the day ended), with no 13/14 October rows. Its 17 stored impressions are an incomplete subset, not a comparable four-day total. We do not calculate a misleading discrepancy or split the official range into invented daily values. Campaign start/end columns describe campaign lifetimes, not reporting dates; report metadata defines the period.

No purchases, paying users, revenue or ROAS are inferred from these Ads outcomes. CPA is unavailable when installs are zero. Tap/view/total labels remain separate. Snapshot campaign statuses are not current serving-status claims. Other apps are unavailable, not zero.

## Reproduce

```sh
node --test scripts/apple-ads-verification/validate.test.mjs
node scripts/apple-ads-verification/run.mjs '/absolute/Apple Ads Campaigns(1).csv'
node scripts/apple-ads-verification/publish.mjs '/absolute/Apple Ads Campaigns(1).csv' '/absolute/Apple Ads Campaigns.csv'
```

`run.mjs` compares the source against the retained read-only `stored-overlap.json` excerpt, explicitly filtered to the report window. `publish.mjs` validates sums, currency, timezone, scope, duplicate IDs and attribution components, then atomically replaces the local static JSON. Original files remain unchanged. It accepts this checkpoint's InnerType EUR/UTC scope only; additional app/currency/timezone mappings require deliberate validation. No daily allocation or generic ingestion framework.

Five regression tests pass. Independent Python/Decimal checks reproduce both CSV totals and the matched campaign/day, plus published source hash/13-impression control. Existing 15 reporting tests pass. Browser checks confirm one-day/range switching, both themes, zero values, unavailable CPA and source caveats. Stored rows were read using authorized SQL, not expanded runtime reader privileges.

**Next step:** validate a longer *daily-grain* official report and a fresh nonzero spend/conversion control before claiming complete daily campaign monitoring. For refreshable reporting, locate an existing working read-only Apple Ads credential on the deployed Kopa service or obtain an explicitly approved read-only API setup; do not create users, keys or permissions without approval. M6 remains a manual historical slice, not a completed live integration. POIS/PASSPORT campaign reporting awaits actual campaigns and source coverage.
