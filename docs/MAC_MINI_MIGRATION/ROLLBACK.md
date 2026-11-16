# Source-specific rollback

Before every future cutover, retain the exact Vercel production deployment/configuration, schedule list, secret **names**, worker Git SHA, last successful run ID, and source/date coverage. No rollback is needed for this Phase 1 handover because nothing live changed.

If a Mac worker fails after its approved cutover:

1. Stop **only** that LaunchAgent (`launchctl bootout "gui/$(id -u)" /absolute/path/to/approved.plist`) and confirm its process ended; do not delete local logs or Supabase rows.
2. Confirm there is no active distributed lease/transaction. Wait for expiry or use the documented owner-approved release path; do not force a second writer while an old run is still committing.
3. Restore **only** that Vercel schedule via a reviewed deployment/configuration or an eligible prior deployment. Verify the schedule and `CRON_SECRET` are effective, then trigger one bounded job if needed. Vercel's rollback semantics may restore the earlier secret and scheduled run delivery around promotion can be skipped or repeated ([Vercel cron deployment guidance](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)).
4. Reconcile missing dates/keywords from official source and `aso_sync_runs`; backfill within the provider's and importer's safe bounds. Never overwrite better processing-date revisions or manufacture missing Apple web ranks. Recheck Kopa freshness and source labels.
5. Keep the Mac job disabled until a fix passes isolated overlap/retry tests and a new cutover is approved.

If the Mac mini is offline, network-limited, its Keychain is locked, or it misses a `launchd` time, treat that worker's source as stale/unavailable and use the same rollback steps. Never use a stale local cached CSV or synthetic fixture as a live substitute. Supabase database and historical records stay in place. The three unrelated Supabase Form retention jobs and public ingest/webhook endpoints should not be touched as part of a Kopa worker rollback.
