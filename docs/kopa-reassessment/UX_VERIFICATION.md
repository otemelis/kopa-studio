# UX verification record

Executed 14–15 October 2026. This record separates implemented behavior, observed checks and remaining acceptance work.

## Boundaries verified

- Prototype is a separate buildless HTML/CSS/JS directory. No Next.js production route, database seed, backend import, migration, Ads operation, credential change, deployment, dependency installation or vendor purchase was performed.
- Its CSP sets `connect-src 'none'`; fixtures are generated locally and no fetch/XHR/service connector is implemented. Browser-local notes and saved views are labeled as local.
- SHA-256 comparison of **201 baseline files** covering `apps/tools/src`, Supabase files and `KOPA_ACTIVE_ROADMAP.md` found **zero changes** before packaging. The only real-repository writes in this phase are documentation and the isolated review package under `docs/kopa-reassessment/`.
- No new audit/build result for production is claimed. The earlier forensic audit remains the production technical baseline.

## Executed automated checks

`node --test prototype/analytics.test.cjs`: **11 passed, 0 failed**. Tests cover inclusive prior windows; calendar/leap-year dates; #1-at-top mapping; correct improvement sign; missing/absent/legacy exclusion; empty coverage; segmented gaps and source boundaries; observed population SD; ratio-of-totals CPA; zero-denominator handling; custom/off comparisons; quoted CSV values and statuses.

`node --check` completed for prototype JavaScript. Local asset/link checks are recorded at packaging. No production dependency install or full production test suite was needed for documentation and isolated frontend files.

## Browser checks actually observed

| Check | Result |
|---|---|
| Overview, Keywords and Ads in both directions | Six screens rendered with no observed browser error logs |
| Linked table checkbox and legend | Added/removed plotted keyword; stable identity retained |
| Search and pin | Filtered watchlist to one row; pin became pressed; reset after check |
| Bulk plot / competitor | Four visible keywords plotted; matched competitor fixture appeared |
| Market | DE → US changed terms, scope and observations |
| Date slider / aligned tooltip | Keyboard ArrowRight exposed actual current/prior dates and source status |
| Chart range | Select range dialog applied 5–11 October; summary became 7 days; clear restored full scope |
| Custom comparison | Applied 1–28 September with exact comparator dates visible |
| Event | Metadata v1.8 opened its dated evidence drawer |
| Keyword drawer | Opened rank mean, individual observations, coverage and local-note field |
| Explain entry | Opened deterministic, scope-specific evidence preview |
| Saved view | Created local named view and found it in saved-view list |
| Experiment entry | Prefilled app/market/window/source context and required criterion fields rendered |
| Jump navigation | Destination shortcut dialog rendered |
| Ads hierarchy | Campaign → ad group → targeting keyword → reported terms rendered |
| Ads attribution | View-attributed mode labeled separately from tap and total |
| Ambiguous attribution | Spend retained; attributed downloads/CPA unavailable |
| Reporting delay | Mature totals stopped at 8 October; all-provisional custom window showed no-mature-data panel |
| States | Empty, failed, denied, loading, missing, legacy, stale and legitimate zero rendered |
| Actual CSV download | 56 rows: two selected keywords × 28 days; exact dates, comparator, DE/POIS, methods, observed/failed status; failed positions empty |
| 1280 × 800 | Document width 1280px; chart 984px; table scroll contained |
| 390 × 844 | Document width 390px; chart 268px; wrapped scope and compact navigation |
| 1440 × 900 | Both directions and all primary screens visually inspected/captured |

Screenshots are generated from the prototype browser, not image-generated concepts. The CSV included alongside the prototype is the downloaded file, not a separately fabricated export example.

## Contrast and keyboard evidence

Core foreground/background tokens were calculated using the WCAG relative-luminance formula; updated secondary text tokens also pass on their quiet table fills. Primary text, secondary text, CTA labels and semantic movement text meet 4.5:1 in the checked combinations. Focus outlines, native form controls, visible status symbols and text labels are implemented. Date scrubbing and range-dialog use were browser-checked. These checks do not certify full WCAG conformance.

## Remaining limits — do not call these passed

- In-app browser Back did not visibly restore the expected prior custom window during the run. URL state and `popstate` rendering exist, but normal-browser Back/Forward/refresh and saved-view restoration require acceptance before production migration.
- Direct local-file opening was not browser-verified because the in-app browser permits HTTP/HTTPS only. Localhost serving was verified; a portable folder and start command are supplied.
- Pointer dragging and hover-path-to-row behavior are implemented but not directly exercised by the DOM-only browser tool. Date-range filtering and keyboard tooltips were tested through their accessible controls.
- Full screen-reader behavior, real touch input, 200–400% zoom/reflow, every multi-sort combination, note persistence across browser restarts, completed experiment submission/evaluation, and cross-origin/file-browser storage behavior were not fully tested.
- Vendor account workflows, actual rank-provider data, real complete Ads/ASC windows, money reconciliation, real competitor availability and entitlement were not validated by this prototype.
- Fixture counts are illustrative, including rounded drilldown children and suppressed term remainder. They are not a data-reconciliation acceptance dataset.
- Large-volume responsiveness, library choice, subscription value and AI factuality await their separate gates. No benchmark numbers or owner A/B outcomes are invented.

## Owner approval gate

Review Fieldwork vs Signal, chart/table hierarchy, default comparison, reading density and drawer/experiment capture. Record requested amendments before UX2. Run the real tasks in document 13 against AppFollow/Apple before retiring legacy screens. No approval is inferred from delivering the package.
