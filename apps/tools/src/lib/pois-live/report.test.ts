import { describe, expect, it } from "vitest";
import { buildPoisReport, type PoisEvent } from "./report";

const event = (id: string, installationId: string, name: string, minute: number, channel = "appstore"): PoisEvent => ({
  eventId: id, installationId, name, sessionId: name.startsWith("session_") ? `${installationId}-session` : null,
  occurredAt: `2026-10-21T11:${String(minute).padStart(2, "0")}:00.000Z`,
  receivedAt: `2026-10-21T11:${String(minute).padStart(2, "0")}:01.000Z`,
  appVersion: "1.0", buildChannel: channel, properties: {},
});

describe("POIS owner report", () => {
  it("counts ordered distinct installations, without inflating repeated events", () => {
    const report = buildPoisReport([
      event("3", "a", "onboarding_started", 3), event("1", "a", "app_opened", 1),
      event("2", "a", "app_opened", 2), event("4", "a", "onboarding_completed", 4),
      event("5", "a", "session_started", 5), event("6", "a", "session_ended", 6),
      event("7", "b", "onboarding_started", 1), event("8", "b", "app_opened", 2),
      event("9", "b", "purchase_completed", 3),
    ], "appstore", "2026-10-14T00:00:00Z", "2026-10-21T12:00:00Z");
    expect(report.installationCount).toBe(2);
    expect(report.eventCount).toBe(9);
    expect(report.journey.map((step) => step.installations)).toEqual([2, 1, 1, 1, 1]);
    expect(report.purchaseCompletions).toBe(1);
    expect(report.observedSessions).toBe(1);
  });

  it("rejects mixed production and TestFlight rows", () => {
    expect(() => buildPoisReport([event("1", "a", "app_opened", 1, "testflight")], "appstore", "a", "b"))
      .toThrow("Mixed POIS build channels");
  });

  it("uses observed properties, matched session IDs and evaluated seconds for activation", () => {
    const withProps = (id: string, installation: string, name: string, minute: number,
      properties: Record<string, unknown>, sessionId: string | null = null): PoisEvent =>
      ({ ...event(id, installation, name, minute), sessionId, properties });
    const report = buildPoisReport([
      withProps("1", "a", "app_opened", 1, { first_launch: true }),
      withProps("1", "a", "app_opened", 1, { first_launch: true }), // retransmission
      withProps("2", "a", "airpods_state_changed", 2, { state: "sensing" }),
      withProps("3", "a", "proof_cue_actually_played", 3, {}),
      withProps("4", "a", "session_started", 4, {}, "real-a"),
      withProps("5", "a", "session_ended", 5, { tracked_seconds: 600, wall_clock_seconds: 900 }, "real-a"),
      withProps("6", "b", "session_ended", 6, { tracked_seconds: 1200 }, "missing-start"),
      withProps("7", "a", "paywall_viewed", 7, { preview: true }),
      withProps("8", "a", "paywall_viewed", 8, { preview: false }),
    ], "appstore", "2026-10-21T11:00:00Z", "2026-10-21T12:00:00Z");
    expect(report.eventCount).toBe(8);
    expect(report.activation).toEqual({ firstOpens: 1, confirmedSensing: 1, proofHeard: 1,
      onboardingStarters: 0, onboardingCompleters: 0, noHeadphonesExplorers: 0, demoCompleters: 0,
      realSessionStarters: 1, meaningfulSessions: 1, realPaywallViewers: 1, unmatchedSessionEnds: 1 });
  });

  it("keeps the no-headphones demo branch separate from real activation", () => {
    const withProps = (id: string, name: string, minute: number, properties: Record<string, unknown> = {}): PoisEvent =>
      ({ ...event(id, "new-install", name, minute), properties });
    const report = buildPoisReport([
      withProps("1", "app_opened", 1, { first_launch: true }),
      withProps("2", "onboarding_started", 2),
      withProps("3", "exploration_entered", 3, { entry_reason: "missing" }),
      withProps("4", "demo_started", 4, { headphone_state: "missing" }),
      withProps("5", "demo_cue_played", 5),
      withProps("6", "demo_completed", 6, { cue_outcome: "played" }),
    ], "appstore", "2026-10-21T11:00:00Z", "2026-10-21T12:00:00Z");
    expect(report.activation).toMatchObject({
      firstOpens: 1, onboardingStarters: 1, onboardingCompleters: 0,
      noHeadphonesExplorers: 1, demoCompleters: 1,
      confirmedSensing: 0, proofHeard: 0, realSessionStarters: 0,
    });
  });
});
