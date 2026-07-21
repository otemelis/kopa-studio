import { describe, expect, it } from "vitest";
import { appleAdsAppMappingSchema, appleAdsConnectionSchema, canTransitionJob, insightActionSchema, paginationSchema } from "./api";

describe("job transitions", () => {
  it("prevents terminal jobs from being completed twice", () => expect(canTransitionJob("completed", "completed")).toBe(false));
  it("allows a failed job to be safely re-queued", () => expect(canTransitionJob("failed", "queued")).toBe(true));
});
describe("pagination", () => {
  it("accepts a bounded page", () => expect(paginationSchema.parse({ limit: "50" }).limit).toBe(50));
  it("rejects oversized limits", () => expect(paginationSchema.safeParse({ limit: "999" }).success).toBe(false));
});
describe("insight actions", () => {
  it("allows only retained insight states", () => expect(insightActionSchema.safeParse({ action: "snoozed" }).success).toBe(true));
  it("rejects arbitrary status changes", () => expect(insightActionSchema.safeParse({ action: "active" }).success).toBe(false));
});
describe("Apple Ads setup", () => {
  it("accepts a read-only organization record", () => expect(appleAdsConnectionSchema.safeParse({ appleAdsOrgId: "23026890", appleAdsOrgName: "Otas Temelis" }).success).toBe(true));
  it("rejects a nonnumeric Adam ID", () => expect(appleAdsAppMappingSchema.safeParse({ connectionId: "0f8fad5b-d9cb-469f-a165-70867728950e", appId: "7c9e6679-7425-40de-944b-e07fc1f90ae7", adamId: "not-an-id" }).success).toBe(false));
});
