export type PoisEvent = {
  eventId: string;
  installationId: string;
  sessionId: string | null;
  name: string;
  occurredAt: string;
  receivedAt: string;
  appVersion: string | null;
  buildChannel: string;
  properties: Record<string, unknown>;
};

const JOURNEY = [
  ["app_opened", "App opened"],
  ["onboarding_started", "Onboarding started"],
  ["onboarding_completed", "Onboarding completed"],
  ["session_started", "Session started"],
  ["session_ended", "Session ended"],
] as const;

export function buildPoisReport(events: PoisEvent[], channel: string, since: string, until: string) {
  // The source query is channel-scoped too. This check prevents accidental cross-channel displays.
  if (events.some((event) => event.buildChannel !== channel))
    throw new Error("Mixed POIS build channels");
  const deduplicated = [...new Map(events.map((event) => [event.eventId, event])).values()];
  const ordered = deduplicated.sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId),
  );
  const installations = new Set(ordered.map((e) => e.installationId));
  const byInstallation = new Map<string, PoisEvent[]>();
  for (const event of ordered) {
    const list = byInstallation.get(event.installationId) ?? [];
    list.push(event);
    byInstallation.set(event.installationId, list);
  }
  const journey = JOURNEY.map(([name, label], step) => {
    let reached = 0;
    for (const list of byInstallation.values()) {
      let cursor = -1;
      let complete = true;
      for (const [required] of JOURNEY.slice(0, step + 1)) {
        const next = list.findIndex((event, index) => index > cursor && event.name === required);
        if (next < 0) { complete = false; break; }
        cursor = next;
      }
      if (complete) reached++;
    }
    return { name, label, installations: reached };
  });
  const byName = new Map<string, { events: number; installations: Set<string> }>();
  const byDay = new Map<string, Set<string>>();
  for (const event of ordered) {
    const summary = byName.get(event.name) ?? { events: 0, installations: new Set<string>() };
    summary.events++;
    summary.installations.add(event.installationId);
    byName.set(event.name, summary);
    const day = event.occurredAt.slice(0, 10);
    const set = byDay.get(day) ?? new Set<string>();
    set.add(event.installationId);
    byDay.set(day, set);
  }
  const uniqueFor = (name: string) => byName.get(name)?.installations.size ?? 0;
  const observedSessions = new Set(ordered.filter((e) => e.sessionId).map((e) => e.sessionId)).size;
  const installationsFor = (predicate: (event: PoisEvent) => boolean) =>
    new Set(ordered.filter(predicate).map((event) => event.installationId)).size;
  const starts = new Set(ordered.filter((event) => event.name === "session_started" && event.sessionId)
    .map((event) => `${event.installationId}:${event.sessionId}`));
  const matchedEnds = ordered.filter((event) => event.name === "session_ended" && event.sessionId &&
    starts.has(`${event.installationId}:${event.sessionId}`));
  const meaningfulSessions = new Set(matchedEnds.filter((event) => {
    const seconds = event.properties.tracked_seconds;
    return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 600;
  }).map((event) => event.installationId)).size;
  return {
    channel, since, until,
    eventCount: ordered.length,
    installationCount: installations.size,
    observedSessions,
    latestReceivedAt: ordered.reduce<string | null>((latest, e) => !latest || e.receivedAt > latest ? e.receivedAt : latest, null),
    journey,
    paywallViews: uniqueFor("paywall_viewed"),
    purchaseCompletions: uniqueFor("purchase_completed"),
    activation: {
      firstOpens: installationsFor((event) => event.name === "app_opened" && event.properties.first_launch === true),
      confirmedSensing: installationsFor((event) => event.name === "airpods_state_changed" && event.properties.state === "sensing"),
      proofHeard: uniqueFor("proof_cue_actually_played"),
      realSessionStarters: installationsFor((event) => event.name === "session_started" && Boolean(event.sessionId)),
      meaningfulSessions,
      realPaywallViewers: installationsFor((event) => event.name === "paywall_viewed" && event.properties.preview === false),
      unmatchedSessionEnds: ordered.filter((event) => event.name === "session_ended" && (!event.sessionId ||
        !starts.has(`${event.installationId}:${event.sessionId}`))).length,
    },
    daily: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, ids]) => ({ date, installations: ids.size })),
    events: [...byName].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, events: value.events, installations: value.installations.size })),
    versions: [...new Set(ordered.map((e) => e.appVersion).filter(Boolean))].sort(),
  };
}
