# PASSPORT internal TestFlight build · 16 October 2026

**1.0.1 (2) uploaded successfully. Apple upload status: PROCESSING, with no errors or warnings. Installation availability and genuine device delivery are pending.**

The signed Release archive was built from development commit `64059ee6d104f1041cdd8c0d48718e804e7fccf6` (analytics fix `81f4648`). Archive-time overrides `MARKETING_VERSION=1.0.1 CURRENT_PROJECT_VERSION=2` isolate its analytics from old 1.0 additive clients without changing the original project checkout. Release compilation and strict signature verification pass. The unchanged analytics candidate previously passed 22 simulator tests and isolated restore/replay checks.

Xcode export uses `app-store-connect`, destination `upload`, fixed build numbering and `testFlightInternalTestingOnly=true`. The existing PASSPORT internal group already has access to all builds; no tester/group permissions were changed. Internal-only audience must also be confirmed on the processed build resource when Apple exposes it.

The first upload stalled during analysis. Only this task's upload process was stopped; the same archive was retried once and resumed upload record `efd06702-6684-42d8-b02b-85557e430fbd`. Xcode reported EXPORT SUCCEEDED at 16:41 Europe/Berlin; official upload resource confirms PROCESSING and uploadedDate 2026-10-16T07:41:00-07:00. No accepted hosted fixtures were sent.

App Store version 1.0 remains PREPARE_FOR_SUBMISSION, selecting original build 1 (`3cb418d8-c3c7-49fa-b89c-9ff0ae80cee3`). No App Review submission, public release, external testing, original-checkout change or Kopa UI change was performed.

## Next step

Once Apple makes the build available, install 1.0.1 (2) through TestFlight, use it normally with anonymous usage sharing enabled, and reopen after a completed device-local day. See PASSPORT_DEVICE_CHECKLIST.md. Upload attempts are spaced six hours apart; do not alter device time or seed past events. No real iPhone was connected for installation or hands-on testing.

Then perform the saved SELECT-only delivery checks for testflight/version 1.0.1 and inspect PASSPORT receipt arrival. Tester observations remain separate from customer metrics. Normal acknowledged reopens do not prove a lost-response retry; hosted delivery/replay must remain pending until observed. App Store shipping remains a separate approval.
