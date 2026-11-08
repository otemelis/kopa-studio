import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/aso/apple-popularity-schedule", () => ({ refreshPendingApplePopularity: refresh }));
import { GET } from "./route";

describe("scheduled Apple demand route", () => {
  afterEach(() => { vi.unstubAllEnvs(); refresh.mockReset(); });

  it("fails closed without a secret or valid bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://tools.example/api/aso/apple-popularity/scheduled"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect((await GET(new Request("https://tools.example/api/aso/apple-popularity/scheduled"))).status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("blocks preview writes even with the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await GET(new Request("https://tools.example/api/aso/apple-popularity/scheduled", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(403);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns bounded completion and signals failures for the next catch-up run", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("VERCEL_ENV", "production");
    refresh.mockResolvedValue({ weekStart: "2026-11-01", selected: 2, completed: 1, remaining: 1, failures: [{ appId: "one", country: "US", error: "provider failed" }] });
    const response = await GET(new Request("https://tools.example/api/aso/apple-popularity/scheduled", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(503);
    expect((await response.json()).remaining).toBe(1);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
