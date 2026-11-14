# PASSPORT running-count ingest: migration review

Status: local candidate only. **No production migration, collector deployment, app change, or live fixture upload has occurred.**

## What is live now

The deployed `passport-ingest-aggregates` function (version 12, checked 14 November 2026) accepts schema 1 additive counts and the older schema 2 `batch_id` receipt contract. The three fixtures in the PASSPORT repository describe that older `batch_id` contract. They contain no `install_day_key`; the live function has no running-total branch. The existing `public.passport_ingest_batch` RPC deduplicates byte-identical batches but adds new batches to `passport_analytics.daily_counts`. No released PASSPORT client is known to use the new per-day contract.

## Proposed additive contract

One running-total request contains exactly one device-local calendar day. `install_day_key` is a random UUIDv4 generated once per installation **per day** and reused for that day's every send. The client must keep the day, key, build channel and app version stable until its confirmed final send. It must not send any installation ID or user ID.

```json
{
  "schema": 2,
  "install_day_key": "3f0c1d9e-6a2b-4c8e-9d7f-1a2b3c4d5e6f",
  "build_channel": "appstore",
  "app_version": "1.4",
  "days": [{
    "day": "2026-11-14",
    "counts": {"app_opened|layout=regular": 5}
  }]
}
```

Successful response:

```json
{"ok":true,"schema":2,"rows":1,"rejected":0,"replaced":1}
```

`rows` counts valid event keys examined, including unchanged retries. `replaced` counts existing per-key values raised by this request; the first insert is not a replacement. Equal or lower values do not change the stored total. Unknown event keys are excluded and reported in `rejected`; the app must not treat a response with `rejected > 0` as a complete acknowledgement. A day-token reused for another day, channel or version, or a day outside the 35-day offline window, receives HTTP 409. No raw key or token is logged.

The older schema-2 `batch_id` request and acknowledgement remain supported separately. Schema 1 is untouched. This is a new schema-2 **variant**; the PASSPORT fixtures need a separate iOS-owner update before app implementation. Do not change their old expected response or use a `batch_id` for running totals.

## Database and privacy

Review [`20261114130821_passport_running_daily_counts.sql`](../../../supabase/migrations/20261114130821_passport_running_daily_counts.sql) before approval. It creates only `passport_analytics.running_daily_counts` and `public.passport_ingest_running_day(jsonb)`. The new table is private, RLS-enabled, and granted only to `service_role`; the RPC is executable only by `service_role`. The collector already calls its RPC using that role. It does not modify `passport_analytics.ingest`, `public.passport_ingest_daily`, `public.passport_ingest_batch`, receipts, or any other app's schema.

For each accepted key, the new RPC stores the greatest per-day running count and adds **only the positive delta** to existing `daily_counts`. Thus Kopa's current read-only dashboard query remains valid, and schema-1 historical totals are preserved. Uploads for a given token are serialized in a transaction. The per-day token is dropped after 35 days while its contribution remains as anonymous daily totals. The 35-day limit matches PASSPORT's current offline queue; a 7-day limit would discard still-queued valid uploads. Any upload older than 35 days is rejected rather than risking double counting after token pruning. This retention is a deliberate privacy/reliability trade-off for owner review.

## Validation and release gate

- Isolated PostgreSQL 16.15 test: schema-1 seed 5; first running count 2, identical retry, higher 5, stale 3, second token 4 produced daily totals 7, 7, 10, 10, 14. Replacement counts were 0, 0, 1, 0, 0. The test also verified `anon` and `authenticated` cannot execute the new RPC.
- Edge function typecheck passed with Deno 2.9.6. No live schema-2 running request was sent.
- After approval: apply the reviewed migration, verify grants/RLS and a restorable backup or approved alternative; deploy the single collector function with JWT verification retained; send a controlled schema-2 test key to the live route, including identical and smaller retries; verify SQL totals and Kopa; verify a schema-1 request still adds once. Use dedicated testflight channel and a unique test day/key so no customer metric is contaminated.

The app owner should implement a durable per-day key and monotonic cumulative counts, send on background when possible, retry without changing the key, and remove a day only after the first post-midnight final send receives `ok=true`, `rejected=0` and the expected `rows`. A background send is best effort on iOS; the next foreground launch remains a necessary retry path.

On an upgrade from schema 1, the app must not resend a day already acknowledged under schema 1 as a schema-2 running day: the two protocols have no shared per-install key and would double-count that day. Start the new protocol on a fresh day (or keep an upgrade-day source boundary) and retain the existing schema-1 delivery path for any queued old days. A same-day app-version change must keep the original version associated with that day's key, or the server will reject the scope change.
