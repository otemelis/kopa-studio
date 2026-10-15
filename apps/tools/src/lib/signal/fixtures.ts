import {
  dates,
  shift,
  SNAPSHOT,
  RETURN_EVENTS,
  type SampleApp,
  type EventFact,
  type KeywordSeries,
  type SignalScope,
} from "./contracts";
export const JOURNEYS: Record<SampleApp, string[]> = {
  pois: [
    "first_open",
    "onboarding_started",
    "calibration_completed",
    "session_started",
    "session_completed",
    "paywall_seen",
    "trial_started",
    "subscription_active",
  ],
  innertype: [
    "app_first_open",
    "assessment_started",
    "assessment_completed",
    "result_viewed",
    "paywall_viewed",
    "purchase_tapped",
    "purchase_success",
  ],
  lovetype: [
    "first_open",
    "test_started",
    "test_completed",
    "basic_results",
    "premium_paywall",
    "unlock_tapped",
    "purchase_client_signal",
  ],
};
export const human = (name: string) =>
  name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export function productFixture(): EventFact[] {
  const out: EventFact[] = [];
  for (const app of ["pois", "innertype", "lovetype"] as const)
    for (const country of ["DE", "US"] as const)
      for (let day = 0; day < 64; day++)
        for (let n = 0; n < 4; n++) {
          const date = shift(SNAPSHOT, day - 63),
            id = `sample-${app}-${country}-${day}-${n}`,
            names = JOURNEYS[app],
            stop = n === 0 ? names.length : n === 1 ? 5 : n === 2 ? 3 : 2;
          const emit = (
            name: string,
            d: string,
            minute: number,
            session: string,
          ) => {
            out.push({
              id: id + "-" + name + "-" + d,
              app,
              installId: id,
              sessionId: session,
              name,
              at: d + `T10:${String(minute).padStart(2, "0")}:00.000Z`,
              environment: "prod",
              version: day < 40 ? "1.7.0" : "1.8.0",
              country,
              schemaVersion: 1,
              properties: {
                locale: country === "DE" ? "de-DE" : "en-US",
                ...(name === "cue_used" ? { cue: "gentle" } : {}),
              },
            });
          };
          names
            .slice(0, stop)
            .forEach((name, i) => emit(name, date, i * 3, id + "-first"));
          for (const lag of [1, 3, 7, 14, 30])
            if (
              shift(date, lag) <= SNAPSHOT &&
              (day + n + lag) % (lag === 30 ? 5 : 3) !== 0
            ) {
              const d = shift(date, lag);
              emit(
                app === "innertype" ? "session_start" : "session_started",
                d,
                1,
                id + "-" + lag,
              );
              emit(RETURN_EVENTS[app], d, 9, id + "-" + lag);
              if (app === "pois" && n % 2 === 0)
                emit("cue_used", d, 5, id + "-" + lag);
            }
        }
  return out;
}
export const ALL_SAMPLE_EVENTS = productFixture();
export function keywordFixture(s: SignalScope): KeywordSeries[] {
  const names =
    s.country === "DE"
      ? [
          "haltung verbessern",
          "airpods haltung",
          "nackenhaltung",
          "gerade sitzen",
          "haltung erinnerung",
          "kopfhaltung",
          "büro haltung",
          "pois",
        ]
      : [
          "posture reminder",
          "airpods posture",
          "neck posture",
          "sit straight",
          "posture awareness",
          "head posture",
          "desk posture",
          "pois",
        ];
  return names.map((name, k) => ({
    id: "k" + k,
    name:
      s.app === "pois"
        ? name
        : (s.app === "innertype"
            ? [
                "personality test",
                "big five",
                "self discovery",
                "personality type",
                "attachment test",
                "character test",
                "inner type",
                "innertype",
              ]
            : [
                "relationship test",
                "attachment style",
                "love test",
                "couple test",
                "communication",
                "relationship style",
                "love type",
                "lovetype",
              ])[k],
    intent: k % 3 === 0 ? "Core intent" : k % 3 === 1 ? "Feature" : "Discovery",
    points: dates(shift(SNAPSHOT, -179), SNAPSHOT).map((date, i) => {
      const status =
        s.state === "stale" && date > "2026-10-06"
          ? "stale"
          : s.state === "partial" && i % 11 === 0
            ? "failed"
            : k === 3 && i % 13 === 0
              ? "absent"
              : k === 6 && i < 110
                ? "untracked"
                : "observed";
      return {
        date,
        rank:
          status === "observed"
            ? Math.max(
                1,
                Math.round(
                  [30, 15, 7, 38, 20, 46, 64, 3][k] +
                    ([-17, -7, 21, -9, 3, -18, 7, -1][k] * (i - 152)) / 27 +
                    Math.sin(i * (k + 2) * 0.62) * 1.4 +
                    (s.country === "US" ? 5 : 0),
                ),
              )
            : null,
        status,
        method: i < 126 ? "itunes_legacy" : "vendor_sample",
        depth: 100,
      };
    }),
  }));
}
export function acquisitionFixture(s: SignalScope) {
  return dates(shift(SNAPSHOT, -179), SNAPSHOT).map((date, i) => ({
    date,
    downloads:
      Math.round(28 + i * 0.12 + Math.sin(i * 0.53) * 7) *
      (s.app === "pois" ? 1 : 2),
    spend: +(21 + i * 0.15 + Math.sin(i * 0.45) * 6).toFixed(2),
    taps: Math.round(32 + i * 0.2 + Math.sin(i * 0.4) * 8),
    tapDownloads: Math.round(12 + i * 0.07 + Math.sin(i * 0.5) * 4),
    viewDownloads: Math.round(2 + i * 0.01),
    proceeds: +((24 + i * 0.1) * 0.48).toFixed(2),
  }));
}
