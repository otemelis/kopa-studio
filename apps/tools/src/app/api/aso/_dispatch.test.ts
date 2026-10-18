import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchCollection } from "./_dispatch";

describe("ASO cron dispatch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed when the cron secret is unavailable", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await dispatchCollection(new Request("https://tools.example/api"), "rankings");

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsigned requests without contacting the collector", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await dispatchCollection(new Request("https://tools.example/api"), "rankings");

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["rankings", "maintenance"] as const)("forwards the %s scope to the existing collector", async (scope) => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("ASO_COLLECTOR_URL", "https://collector.example/api/aso/collect");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://tools.example/api", { headers: { Authorization: "Bearer test-secret" } });
    const response = await dispatchCollection(request, scope);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`https://collector.example/api/aso/collect?scope=${scope}`);
    expect(options).toEqual({
      headers: { Authorization: "Bearer test-secret", Accept: "application/json" },
      cache: "no-store",
    });
  });
});
