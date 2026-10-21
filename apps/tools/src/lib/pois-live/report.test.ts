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
});
