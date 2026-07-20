# Migrating other apps to the shared analytics schema

InnerType now writes to a new shared `events` table in the Supabase project
`dsjgbxkerucutrjltgws` (the project shared across your apps), instead of its
old app-specific `analytics_events` table. This doc is what each other app
(LoveType, Unpark, Maze Run, Bolt Away, ...) needs to adopt the same schema.

## 1. Backend (one-time, per project — already done for this project)

The shared tables already exist in `dsjgbxkerucutrjltgws` (don't recreate them):

- `events` — the shared event log. Columns: `app_id`, `environment` ('prod'/'dev'),
  `event_name`, `anonymous_id` (uuid), `session_id` (uuid), `platform`,
  `app_version`, `os_version`, `country` (server-derived), `client_event_time`,
  `received_at`, `properties` (jsonb).
- `event_catalog` — allow-list of `(app_id, event_name)` pairs. The `track`
  Edge Function REJECTS any event not listed here — you must insert a catalog
  row before your app can emit a new event name.
- `app_api_keys` — one row per app: `app_id` + sha256 hash of a per-app API key.
  Generate a new key for each app (`uuidgen` twice concatenated works fine),
  hash it, insert the hash — never store the raw key in the database.
- `installs` — Apple Search Ads attribution results, keyed by `(app_id, anonymous_id)`.

Two Edge Functions already deployed and shared by all apps:
- `POST /functions/v1/track` — batched event ingestion. Body: `{app_id, events: [...]}`,
  header `x-api-key: <your app's raw key>`. Max 50 events per call.
- `POST /functions/v1/attribution` — Apple Search Ads resolution. Body:
  `{app_id, anonymous_id, token}`. Returns `{source: 'organic'|'asa'|'unknown'}`.

**Per new app, you only need to:**
1. Generate an API key, insert its hash into `app_api_keys` (`INSERT INTO app_api_keys (app_id, key_hash) VALUES ('<yourapp>', '<sha256hex>')`).
2. Insert your app's event catalog rows (see step 2 below) into `event_catalog`.
3. Ship the raw key to the app via `eas.json` build env as `EXPO_PUBLIC_EVENTS_API_KEY`.

## 2. Event catalog — required events for every app

Insert one `event_catalog` row per event name per app before the app can emit it.
Reuse InnerType's naming exactly (`app_id` differs, `event_name` should match
where the concept is the same, so cross-app funnels stay comparable):

| event_name | required_properties | when to fire |
|---|---|---|
| `app_first_open` | `{}` | once ever, first launch after install |
| `session_start` | `{}` | app launch, and again after >30 min backgrounded |
| `session_end` | `{duration_seconds}` | app backgrounded |
| `app_opened` | `{}` | every launch (legacy-compatible event, kept alongside session_start) |
| `question_answered` *(if your app has a quiz/assessment flow)* | `{assessment_type, question_number}` | per question answered |
| `assessment_started` | `{assessment_type}` | user starts a quiz/assessment |
| `assessment_completed` | `{assessment_type}` | user finishes a quiz/assessment |
| `assessment_exited` | `{assessment_type, last_question_number}` | user explicitly backs out mid-assessment |
| `assessment_abandoned` | `{assessment_type, last_question_number}` | detected at next launch: in-progress assessment idle >30 min, never explicitly exited |
| `result_viewed` | `{assessment_type}` | result screen shown |
| `paywall_viewed` | `{}` | paywall/upsell screen shown |
| `paywall_product_loaded` | `{product_id}` | store product/offering loaded successfully |
| `price_seen` | `{price_string, currency}` | localized price actually rendered to the user |
| `purchase_tapped` | `{}` | user taps the buy/unlock CTA |
| `purchase_success` | `{product_id}` | purchase completed, entitlement active |
| `purchase_cancelled` | `{}` | user cancelled the system purchase dialog |
| `purchase_failed` | `{error_code}` | purchase threw a real error (not user-cancel) |
| `purchase_restored` | `{}` | restore-purchases resulted in active entitlement |
| `ad_sdk_initialized` *(ad-supported apps)* | `{network}` | ad SDK finished setup successfully |
| `ad_placement_available` | `{placement, ad_format, network}` | SDK reports a placement/ad unit is loaded and ready |
| `ad_placement_unavailable` | `{placement, ad_format, network, error_code}` | SDK failed to load or has no fill for a placement |
| `ad_rewarded_requested` | `{placement}` | user taps a rewarded-ad CTA |
| `ad_rewarded_started` | `{placement, ad_format, network}` | rewarded ad starts showing |
| `ad_rewarded_completed` | `{placement, reward_type, reward_amount}` | user earns the rewarded-ad grant |
| `ad_rewarded_failed` | `{placement, error_code}` | rewarded ad request/show fails before reward is granted |
| `interstitial_eligible` | `{placement, level, reason}` | app decides an interstitial can be shown before cooldown/fill checks |
| `interstitial_shown` | `{placement, level, network}` | interstitial starts showing |
| `interstitial_dismissed` | `{placement, level}` | user closes/finishes an interstitial |
| `banner_shown` | `{placement, ad_format, network}` | banner placement becomes visible to the user |
| `ad_impression` | `{placement, ad_format, network, ad_unit_id}` | any paid ad impression is reported by the SDK |
| `ad_revenue_paid` | `{placement, ad_format, network, ad_unit_id, revenue, currency, precision}` | impression-level revenue callback fires, e.g. AppLovin MAX ILRD |
| `rating_prompt_shown` | `{}` | in-app rating/review modal shown |
| `rating_prompt_dismissed` | `{}` | rating modal dismissed without action |
| `rating_prompt_positive_tap` | `{}` | user gave a positive rating, about to be routed to store review |
| `app_store_review_requested` | `{rating}` | `StoreReview.requestReview()` actually called |
| `language_changed` | `{from, to}` | user changes app language in settings (only if app is localized) |

Skip any row that doesn't apply to a given app's feature set (e.g. games skip
`question_answered`/`assessment_*`, non-localized apps skip `language_changed`).

Every property list above is a MINIMUM — you can always add more keys inside
`properties`; only `event_name` itself is validated against the catalog.

## 3. Client-side conventions (mirror InnerType's `src/lib/analyticsClient.ts`)

Every event automatically carries these — implement once per app, reuse everywhere:

- `app_id` — hardcoded per app (e.g. `'lovetype'`, `'unpark'`).
- `environment` — `'dev'` when `__DEV__`, else `'prod'`. Keeps test traffic out of production funnels.
- `anonymous_id` — persistent per-install UUID (AsyncStorage), same idea as InnerType's `installationId.ts`.
- `session_id` — UUID rotated per launch and after >30 min backgrounded.
- `platform` / `app_version` / `os_version` — from `Platform.OS`, `expo-constants`, `Platform.Version`.
- `properties.language` — current device/app language code.
- `properties.source` — cached ASA attribution result (`'organic'|'asa'|'unknown'`), same flow as InnerType (see step 4).
- `client_event_time` — set at the moment the event is queued, not when it's flushed (matters for offline queueing).

Batch + queue rather than firing individual inserts:
- Persist an outgoing queue in AsyncStorage.
- Flush when queue ≥ 10, or after a 15s debounce, or when the app backgrounds.
- POST to `track` with `x-api-key` header; on failure, back off (30s → 5 min) and retry — never drop events on a failed request, only on the 7-day/500-event hygiene caps.

## 4. Ad monetisation conventions

Use the same ad event names across every app so portfolio-level dashboards can
compare funnels by app, country, acquisition source, placement, and format.

### Required properties for all ad events

Add these whenever the SDK/app can provide them:

- `placement` — stable app-owned placement name, e.g. `level_complete`,
  `level_skip`, `daily_reward`, `double_reward`, `home_banner`, `gameplay_banner`.
- `ad_format` — one of `rewarded`, `interstitial`, `banner`, `mrec`,
  `app_open`, `native`.
- `network` — mediation/network name, e.g. `applovin_max`, `admob`,
  `unity_ads`, or the MAX network name if available.
- `ad_unit_id` — network placement/ad unit id. This can be useful for debugging
  fill/revenue but should not replace the app-owned `placement`.
- `level`, `screen`, `attempt`, `boss`, `source` — add gameplay or UX context
  when relevant. Games should always include `level` for interstitials and
  rewarded skips/revives when possible.

### Rewarded ads

Track the user intent separately from the SDK outcome:

1. `ad_rewarded_requested` when the user taps the CTA.
2. `ad_rewarded_started` when the rewarded ad actually begins showing.
3. `ad_rewarded_completed` only when the SDK confirms the reward should be
   granted. Include `reward_type` and `reward_amount`.
4. `ad_rewarded_failed` if the SDK cannot load/show the ad or the flow is
   cancelled before reward eligibility.

Do not emit `ad_rewarded_completed` just because the ad modal opened. It should
mean the user earned the reward.

### Interstitials

Track both eligibility and display:

- `interstitial_eligible` when the app's rules say an interstitial opportunity
  exists, e.g. after level 10, after a boss, after N rounds, or after cooldown.
- `interstitial_shown` only when the SDK confirms the ad is shown.
- `interstitial_dismissed` when the ad closes and gameplay/app flow resumes.

If an interstitial was eligible but no ad was available, emit
`ad_placement_unavailable` with `ad_format: 'interstitial'` and the placement.
This makes it possible to separate monetisation design from fill-rate problems.

### Banners

Emit `banner_shown` when the banner placement becomes visible in the UI, not on
every render. For apps with persistent banners, emit once per session per
placement unless the placement is removed and later re-shown on a different
screen.

SDK impression callbacks should additionally emit `ad_impression` and, when
revenue is provided, `ad_revenue_paid`.

### Impression-level revenue

For AppLovin MAX, wire the paid revenue callback / ILRD callback to
`ad_revenue_paid`. Store revenue as a numeric value in standard currency units
(for example `0.0031`, not micros) and include:

- `revenue` — numeric estimated revenue.
- `currency` — usually `USD` unless the SDK provides another currency.
- `precision` — SDK precision string when available, e.g. `exact`,
  `estimated`, `publisher_defined`, or `unknown`.
- `network` — mediated network if MAX provides it.
- `placement`, `ad_format`, `ad_unit_id` — same placement identifiers as above.

Also emit `ad_impression` for every paid impression, even if revenue is missing.
Revenue dashboards should primarily use `ad_revenue_paid`; impression/fill
dashboards can use `ad_impression`, `ad_placement_available`, and
`ad_placement_unavailable`.

### Suggested placement names for games

Use stable lowercase snake_case placement names:

- `level_complete_interstitial`
- `boss_complete_interstitial`
- `level_skip_rewarded`
- `revive_rewarded`
- `double_reward_rewarded`
- `daily_reward_rewarded`
- `home_banner`
- `gameplay_banner`
- `ipad_sidebar_banner`

Keep placement names stable once shipped. If the UX changes, add properties
like `level`, `screen`, `trigger`, or `variant` instead of renaming the
placement.

## 5. Apple Search Ads attribution (only if the app runs/will run ASA campaigns)

- Add a local Expo Module wrapping `AAAttribution.attributionToken()` (copy
  InnerType's `modules/adservices-token/` — it's ~30 lines of Swift, no ATT
  prompt required for the standard payload).
- On `app_first_open`, fetch the token and POST it to `/functions/v1/attribution`
  with your app's `app_id` + `anonymous_id`. Cache the returned `source` locally
  and stamp it on every subsequent event's `properties.source`.
- If the response says `retry: true` (Apple hasn't indexed the token yet),
  retry on the next 2 launches max, then settle on `'unknown'`.

## 6. What NOT to do

- Don't write to `events` directly with the anon key — always go through `track`.
  RLS on `events` has no policies; only the Edge Function's service role can insert.
- Don't reuse another app's API key — each app gets its own row in `app_api_keys`.
- Don't skip the catalog insert — an un-catalogued event is silently rejected
  (check the `track` response's `rejected` array during testing).
- Don't calculate ad revenue from client-side guesses. Use SDK callbacks for
  `ad_revenue_paid` whenever possible.
- Don't use network ad unit ids as the only placement identifier. Always include
  the app-owned `placement`, because ad unit ids change between apps, platforms,
  and environments.
- Don't touch InnerType's legacy `analytics_events` / `user_feedback` tables —
  those stay untouched for old installed InnerType versions only.

## Reference implementation

Read these InnerType files as the working example:
- `supabase/migrations/20260710000000_shared_events_schema.sql` — table DDL
- `supabase/migrations/20260710000001_seed_innertype_event_catalog.sql` — catalog seed pattern
- `supabase/functions/track/index.ts` and `supabase/functions/attribution/index.ts` — Edge Functions (shared, don't redeploy — just insert your app's catalog/key rows)
- `src/lib/analyticsClient.ts` — client queue/batch/flush implementation
- `src/lib/attribution.ts` + `modules/adservices-token/` — ASA attribution flow
- `src/lib/sessionLifecycle.ts` — app_first_open/session_start/session_end/abandonment detection
