# Direct Apple Ads report: reviewed deployment candidate

17 October 2026. Local implementation ready; **not deployed or live-validated**. Expected owner-only URL after approval: https://tools.kopa.studio/reports/apple-ads.

## Working change

The accepted Signal page is delivered from the existing Kopa Tools origin. On open and Refresh, it calls the existing owner-authenticated GET /api/apple-ads/reports/export. That exporter uses protected existing Apple OAuth credentials server-side, reads the owner connection/campaign mapping with SELECTs, and requests daily reports directly from Apple. The browser receives aggregate metrics only. No CSV/JSON handoff or console export is required for routine refresh. Console exports remain periodic independent validation controls.

The current 28 complete UTC days, provider query time and last successful browser refresh are explicit. Exact decimals, matched weekly comparisons and missing-row states reuse the accepted calculations. Failed refresh preserves the previous in-memory values and timestamps; initial failure displays no metrics, and Refresh remains available. No report data is persisted in browser storage. Reloading after a failure has no durable last-good cache; it starts unavailable until a query succeeds. The page does not poll while closed or schedule jobs. It is a direct read-on-open, not background synchronization.

The local localhost:4340 historical page remains unchanged. This narrow hosted page uses the existing login rather than extracting cookies or exposing credentials across origins. No database writes, schema/permission changes, ad actions, scheduler, new credentials or dependencies. No app or ASO code changed. Only InnerType EUR/UTC is supported by the validated client contract; unsupported scopes fail explicitly.

## Original automation finding

The root Vercel cron configuration schedules /api/aso/collect. The Tools application has no declared cron in its vercel.json. Its old Apple Ads worker claims queued campaign jobs and updates Supabase; the old report sync also inserts/updates daily metric records. Those write paths were not invoked. The read-only exporter is already demonstrated to work from the owner's 17 October response. Current external scheduler configuration was not independently verified; code does not establish that an old worker is still scheduled.

App Store Connect already has direct authenticated extraction in scripts/app-store/read-apple.mjs and validated refresh.py publication. Its key remains local; this change neither uploads that key nor deploys/schedules that extractor. Scheduled/unattended ASC refresh remains a separate next slice, using the existing implementation.

## Verification

- 17 reporting/bundle regression tests pass. Bundle syntax and exact CSP hashes are tested, with no unsafe-inline policy.
- 17 owner-route/exporter tests pass both on development dependencies and retained production dependencies. Owner rejection occurs before page delivery; existing exporter owner/SELECT/no-partial tests remain passing.
- Development typecheck/build and isolated retained-production Next15.5.20 build pass.
- Browser replay uses the real owner-saved export111.json at localhost:4343, explicitly labeled LOCAL REPLAY / NO LIVE PROVIDER CALL. Verified initial load, exact EUR5.76/331 impressions/14 taps/9 attributed installs, failed refresh preserving values and times, and successful retry. This is not evidence of a new live Apple request.
- Isolated candidate adds exactly three files to the retained previously verified production source: route.ts, route.test.ts, view.generated.ts under apps/tools/src/app/reports/apple-ads. No baseline source is changed. Generator/test live only on the development branch. Generated page bundles existing styling/calculations, not private report data.

## Deployment gate and exact next action

Roadmap rule9 reserves approval for “production mutations” and rule8 protects live deployments and credentials. Previous approval was explicitly scoped to the four-file exporter; it does not cover this new page. Request approval for these three files only, no provider/permission/credential/schema changes.

The configured Vercel CLI credential currently returns HTTP403 forbidden / Not authorized on project metadata. Consequently the current production baseline and preview cannot be verified. Restore the existing authorized Vercel project access before deployment. Do not add new permission grants, export protected secrets or bypass authentication to work around this.

After access is restored and scoped deployment approved: recheck the actual current production source; if unrelated changes exist, reconstruct from that source and revalidate. Deploy preview and verify auth/security headers/source hashes, then production with only the three additions; verify real owner same-origin fetch and failure state. Do not claim direct live operation until that test succeeds. No new recurring paid service is requested. After this slice, reuse the existing ASC extraction for an appropriately approved refresh/scheduling path.
