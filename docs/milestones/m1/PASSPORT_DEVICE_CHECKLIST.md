# PASSPORT internal TestFlight verification

Target: **1.0.1 (2)**, internal testing only. Install only once Apple marks the build available in TestFlight.

1. Update through TestFlight on your iPhone. Keep existing app data; do not uninstall, reset analytics, change the device clock or clear the passport.
2. Confirm the installed version is 1.0.1 (2). Leave “Share anonymous usage counts” enabled for this test. Open and use the app normally, then background it. No purchase is required.
3. Reopen on the following calendar day in the device's timezone. Only completed local days are eligible for upload; current-day activity stays on device. Failed upload attempts are throttled for six hours, so a failed attempt may require a later reopen.
4. Tell Codex the installed version, dates/timezone and approximate use/reopen times. Do not send personal passport contents. Codex will inspect only PASSPORT-scoped data and verify `build_channel=testflight`, `app_version=1.0.1`, expected local reporting day, aggregate keys and receipt arrival.

These observations are tester activity, not production customer behavior. Counts are events, not unique users or linked funnels. Purchase-completed events are not verified revenue.

After a successful upload, a later reopen should not resend acknowledged completed-day counts. This checks normal acknowledgement behavior; it does not prove a real lost-response replay. Restart, lost-response and concurrent replay behavior already have isolated tests; a hosted lost-response scenario must be explicitly observed before claiming it passed.

No TestFlight install or genuine device delivery has been verified yet. No physical iPhone was available through the local device tools during build preparation.
