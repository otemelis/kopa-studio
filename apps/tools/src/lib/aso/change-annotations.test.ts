import { describe, expect, it } from "vitest";
import { chartChanges } from "./change-annotations";

const changes = [
  { id: "global", date: "2026-11-13", title: "Approval", changeType: "app_version_released", country: "all" },
  { id: "us", date: "2026-11-12", title: "US listing", changeType: "metadata", country: "us" },
  { id: "de", date: "2026-11-11", title: "DE listing", changeType: "metadata", country: "de" },
  { id: "old", date: "2026-10-01", title: "Old listing", changeType: "metadata", country: "all" },
];

describe("chartChanges", () => {
  it("includes portfolio-wide and selected-market entries within the visible dates", () => {
    expect(chartChanges(changes, "us", "2026-11-10", "2026-11-13").map((change) => change.id)).toEqual(["us", "global"]);
  });
  it("does not substitute another storefront or an earlier event", () => {
    expect(chartChanges(changes, "de", "2026-11-12", "2026-11-13").map((change) => change.id)).toEqual(["global"]);
  });
});
