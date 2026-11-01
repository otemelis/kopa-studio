import { describe, expect, it } from "vitest";
import { listingCoverage } from "./listing-coverage";

describe("public listing keyword coverage", () => {
  const listing = { name: "POIS: Posture Reminder", description: "Gentle reminders for better posture and mindful breaks." };
  it("recognizes exact words in the app name", () => expect(listingCoverage("posture reminder", listing)).toBe("name"));
  it("does not match inside a longer word", () => expect(listingCoverage("post", listing)).toBe("not_visible"));
  it("separates a description mention from title targeting", () => expect(listingCoverage("mindful breaks", listing)).toBe("description"));
  it("keeps failed lookups unavailable", () => expect(listingCoverage("posture", null)).toBe("unavailable"));
});
