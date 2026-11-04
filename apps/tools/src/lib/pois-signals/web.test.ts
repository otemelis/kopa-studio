import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readPoisWeb } from "./web";

const originalFetch = global.fetch;
const originalToken = process.env.KOPA_POIS_VERCEL_ANALYTICS_TOKEN;
afterEach(() => {
  global.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.KOPA_POIS_VERCEL_ANALYTICS_TOKEN;
  else process.env.KOPA_POIS_VERCEL_ANALYTICS_TOKEN = originalToken;
});

describe("POIS website analytics", () => {
  it("keeps website numbers unavailable without its own credential", async () => {
    delete process.env.KOPA_POIS_VERCEL_ANALYTICS_TOKEN;
    const fetchMock = vi.fn(); global.fetch = fetchMock;
    expect(await readPoisWeb(7)).toMatchObject({ available: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requests only the withpois project and accepts valid aggregates", async () => {
    process.env.KOPA_POIS_VERCEL_ANALYTICS_TOKEN = "test-token";
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("projectId")).toBe("prj_OK5yKf2OyzWBVfsopoeCer5bdPFx");
      expect(url.searchParams.get("teamId")).toBe("team_YZN5tQECK9yBH6kFQ54p5Ejw");
      const by = url.searchParams.get("by");
      const data = !by ? { visitors: 4, pageviews: 6 } : by === "day"
        ? [{ timestamp: "2026-11-04T00:00:00.000Z", visitors: 4, pageviews: 6 }]
        : [{ [by]: by === "requestPath" ? "/" : "", visitors: 4, pageviews: 6 }];
      return { ok: true, json: async () => ({ data }) } as Response;
    });
    global.fetch = fetchMock;
    const result = await readPoisWeb(7);
    expect(result).toMatchObject({ available: true, visitors: 4, pageviews: 6 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("does not turn a provider failure into zero traffic", async () => {
    process.env.KOPA_POIS_VERCEL_ANALYTICS_TOKEN = "test-token";
    global.fetch = vi.fn(async () => ({ ok: false, status: 403 }) as Response);
    expect(await readPoisWeb(7)).toMatchObject({ available: false });
  });
});
