import { describe, expect, it } from "vitest";
import { canTransitionJob, insightActionSchema, paginationSchema } from "./api";

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
