# Signal development checkpoint — verification and review

15 October 2026. Branch `codex/signal-product-analytics`; original baseline `189d42b6`. Code checkpoints `9b565b28` and `b4b7237c`. This report supersedes the archived static prototype's implementation status. No push, deployment, production data write, schema migration, purchased service, PostHog event transfer or live Ads/App Store operation occurred.

## Run the actual Next preview

From this isolated checkout's `apps/tools` directory, using Node 22+ (verified with 24.13.1):

```sh
npm ci --ignore-scripts
KOPA_SIGNAL_UI=1 KOPA_SIGNAL_FIXTURES=1 npm run dev -- --hostname 127.0.0.1 --port 4338
```

Open `http://127.0.0.1:4338/analytics?data=sample` or `/keywords?data=sample`. The existing local preview is retained for review. It has **no production `.env.local`**. Do not copy production credentials into a fixture preview. Normal non-sample Signal requires the existing owner authentication and shows live data as unavailable. `KOPA_SIGNAL_UI` defaults off; authenticated legacy reports can be selected with `view=legacy`.

The Next app was retained and upgraded from the vulnerable installed baseline to Next 16.4.1, with version-matched documentation reviewed. React and Supabase architecture remain. The middleware-to-proxy rename preserves its behavior; dev/build explicitly use webpack and separate `.next-dev` / `.next` directories. Vitest 5.0.4 and working ESLint configuration replace the broken/advisory-affected baseline tooling. No upstream codemod ran. Package lifecycle scripts were disabled for installs.

## Executed automated verification

| Check | Result | Evidence |
|---|---|---|
| TypeScript + generated Next route types | Passed | `evidence/signal/typecheck.txt` |
| ESLint | 0 errors; 1 existing sign-in full-navigation warning retained | `evidence/signal/lint.txt` |
| Unit / API tests | **167 passed, 34 files** | `evidence/signal/tests.txt` |
| Optimized production build | Passed | `evidence/signal/build.txt` |
| Runtime dependency advisories | **0** | `evidence/signal/production-advisories.json` |
| Entire dependency tree | **5 high**, 0 critical, all remaining in development lint chain | `evidence/signal/development-advisories.json` |
| Palette regression | Light and dark text/tooltip and series contrast targets passed | `src/lib/signal/contrast.test.ts` |
| Unchanged screenshot after reload | Pixel-identical 1280 × 1176 full-page capture, same dark scope | `evidence/signal/visual-regression.json` |
| Whitespace / patch validation | `git diff --check` passed before code checkpoint | Development checkpoint |

The 129 baseline tests plus 38 new tests cover ordered identity-aware conversion, repeat starts, out-of-order/horizon/right-censor handling, app/session isolation, timestamp normalization/deduplication, reverse paths, exact-day retention and incomplete dates, URL scope, fixture production guards, rank missingness, CPA, CSV, display/export definitions, paid attribution reconciliation, schema/privacy gates and theme contrast. The sample API's actual GET handler is tested, including production and flag-off 404 responses. This is not live identity/source accuracy evidence.

Remaining development advisories affect `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next` and `eslint-config-next`. Runtime `--omit=dev` audit is zero. Do not use the suggested forced downgrade to an old ESLint/Next stack. These tools run against local source during development/build and should be patched or explicitly accepted before release; the current report does not declare them resolved. Advisory results are time-specific, not a permanent security guarantee.

## Executed browser walkthrough

The actual localhost Next build was checked through the browser; candidate OSS applications were not executed.

| Interaction | Observed result |
|---|---|
| Six navigation destinations | Shared app/market/date context retained; all use Signal theme treatment |
| Keyword checkbox and linked legend | Selection changes plotted histories and URL; Back restores prior selection |
| Search watchlist | Narrows rows without silently removing plotted histories from chart/export |
| Comparison / date brush keyboard | Arrow key changes selected start date and exact comparator window; date controls provide an alternative |
| Keyword annotation / evidence | Native modal opens; Escape closes; source/causality caveats visible |
| Save view | Owner/browser-local view appears in Saved analyses with full scoped URL |
| Download export | Actual `kopa-SAMPLE-keywords.csv` downloaded; inspected 56 observed-history rows plus header, two selected terms and exact scope |
| Journey node | Opens distinct-identity evidence separately from event count |
| Funnel configuration | Step select, reset and horizon controls work; ordered counts and prior counts visible |
| Cohorts | 90-day view exposes mature D30 and immature cells; selecting a cohort scopes the investigation |
| InnerType events | App switch exposes assessment vocabulary; search and schema/count drawer work; return event uses `session_end` |
| Ads hierarchy | Campaign → group → keyword → reported term works; attribution and CPA modes update; unavailable denominator remains unavailable |
| Local hypothesis | Saved criterion and evaluation date appear in Experiments; reopen preserves originating analysis |
| Command navigation | Button and Meta+K open navigation dialog; Escape closes; Sources link works |
| Source states | Partial, failed, empty, stale reviewed; failure/absence never receives an invented numeric rank |
| Market change / Back | US scope changes URL; Back restores Germany and matching fixture context |
| Theme reload | Dark preference persisted after reload; System resolution tested in unit tests |
| Responsive layouts | Core screens checked at 1440×900 and 1280×800 in both themes; Keywords checked at 390×844; page widths matched viewport widths |

Screenshots are full-page captures: filenames identify viewport width, not full-page image height. Core Overview/Keywords/Ads/Product paths have both desktop/laptop themes. Additional Product funnel/retention/event tabs, source failure and narrow keyword evidence are included. Image baseline comparison only checks this unchanged-view reload; it is **not** a cross-browser CI visual suite or an owner usability study. The small comparison script consumes existing CUA screenshots and never drives a browser or silently accepts new baselines.

## Review sequence

1. Open Keywords in light and dark. Compare two histories; add a third; inspect gaps, prior dates and a metadata annotation. Try on the owner's 13-inch laptop.
2. Move to Apple Ads, drill a campaign into reported terms, change attribution, compare a complete window and export.
3. Open Product Analytics, inspect a transition, configure a funnel, review mature/immature retention, then inspect InnerType events. Every value is sample data.
4. Save an analysis and record a hypothesis with an evaluation criterion. Verify the resulting local note and return to its source scope.
5. Use Sources to see which real-data contracts remain unvalidated. Do not interpret sample source rows as account connections.

## Explicit remaining work

- Verified backup restore; deployed database schema/migrations, writer commits, scheduler and role/ownership inventory.
- Complete historical telemetry mapping and identity stability; stable logical event UUIDs, schema versions, complete date partitions. The latest-1,000 metadata sample cannot prove these.
- Native rank method/terms validation, known non-empty source observations, depth/device/storefront/sponsor comparison and permitted storage. No paid-provider necessity conclusion is made.
- Live ASC/Ads report pagination/revision/currency/timezone and transaction reconciliation; no Signal source adapter is enabled yet.
- One manually reconciled InnerType production funnel/cohort; then PostHog EU project, identity/privacy and cost/limit trial if viable. No new processor receives historical events in this checkpoint.
- Production saved-view/note synchronization, arbitrary validated segments, per-step daily funnel trends, instrumentation of missing native events and verified monetization are not delivered.
- Real AppFollow same-task comparison, owner preference, physical laptop comfort, broader browser/screen-reader and slow-device testing remain unmeasured. Direction selection is complete; no renewed direction approval is requested.

No actual integration or business metric is marked complete solely because fixture screens render. The original checkout and its unrelated screenshot/content files remain outside these commits; historical datasets were not modified.

Recorded terminal logs normalize carriage-return progress updates and trailing whitespace for a clean patch; command outcomes and figures are retained.
