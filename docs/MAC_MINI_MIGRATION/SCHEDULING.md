# launchd, logs and monitoring design

This is a **design for a later approved cutover**, not an installed job. The receiving Mac has no executable Kopa worker CLI yet. Do not point `launchd` at the existing Vercel API handler: it depends on HTTP request/response objects and the serverless Chromium binary.

Use one LaunchAgent per independent worker: `studio.kopa.rankings`, `studio.kopa.maintenance`, `studio.kopa.passport-asc`, `studio.kopa.apple-demand`. Each can be disabled without stopping the others. Use UTC dates **inside** workers for Apple reporting and snapshot keys. `StartCalendarInterval` follows the Mac's local timezone and daylight-saving transitions; do not copy UTC Vercel clock times into a Berlin-time plist without calculating the intended local schedule. Record the effective UTC fire time at every run. Daily coverage should derive from missing database work, not from assuming that exactly one schedule fired.

The following is a template for a **future** `rankings` CLI; replace the nonexistent path after its implementation and code review. Keep secrets out of the plist. The `ProgramArguments` wrapper must retrieve credentials from a reviewed secure store and `exec` Node without echoing values.

Its single illustrative 09:30 local trigger is **not** a coverage-equivalent schedule: the present collector has 527 distinct active keywords and a 48-query bound per run. Set and test enough runs or a bounded drain loop to cover the backlog after the worker exists; do not enable the template as-is.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>studio.kopa.rankings</string>
  <key>ProgramArguments</key><array>
    <string>/Users/WORKER/Developer/kopa-studio/workers/run-rankings-secure</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/WORKER/Developer/kopa-studio</string>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>30</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>/Users/WORKER/Library/Logs/Kopa/rankings.stdout.log</string>
  <key>StandardErrorPath</key><string>/Users/WORKER/Library/Logs/Kopa/rankings.stderr.log</string>
</dict></plist>
```

At later cutover, create the log directory with `umask 077; mkdir -p "$HOME/Library/Logs/Kopa"; chmod 700 "$HOME/Library/Logs/Kopa"`. Validate a plist with `plutil -lint PATH`. Inspect a loaded job with `launchctl print "gui/$(id -u)/studio.kopa.rankings"`; inspect recent output with `tail -n 100 "$HOME/Library/Logs/Kopa/rankings.stdout.log"`. Use `launchctl bootstrap "gui/$(id -u)" PATH` only after owner approval and a reviewed plist; use `launchctl bootout "gui/$(id -u)" PATH` to pause. Keep a manifest of enabled job labels and Git SHAs. Do not set `KeepAlive=true` for a batch worker; it can cause an immediate loop on failure.

Require a small local status file or Supabase `aso_sync_runs` entry with last attempt, last success, last complete source date, item counts, warnings, duration and code SHA. Rotate local logs; redact tokens, full URLs, raw provider payloads and personal data. Alert the owner on stale data, repeated partial source observations, expired credentials, repeated lease conflicts or a skipped run. On wake/reboot, a worker checks the database for missed dates/keywords and performs a bounded catch-up; `launchd` alone does not provide that data cursor. Record the catch-up backlog before claiming success.

Supabase `cron.job_run_details` remains the monitor for the three Form retention jobs. Vercel's Schedules and Function logs remain the monitor for all not-yet-cut-over jobs. The two status systems overlap during migration, but the writer lease must prevent overlapping **writes**.
