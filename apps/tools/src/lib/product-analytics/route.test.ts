import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/product-analytics/repository", () => ({
  readProductReport: vi.fn(),
}));
import { readProductReport } from "./repository";
import { GET } from "@/app/api/signal/product/route";
const request = (
  query = "",
  host = "127.0.0.1:4339",
  origin = "http://127.0.0.1:4339",
) =>
  new Request("http://127.0.0.1:4339/api/signal/product" + query, {
    headers: { host, origin },
  });
const enable = () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("KOPA_SIGNAL_UI", "1");
  vi.stubEnv("KOPA_SIGNAL_LOCAL_READONLY", "1");
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("actual source endpoint", () => {
  it("fails closed in production even when the local flag is set", async () => {
    enable();
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET(request())).status).toBe(404);
    expect(readProductReport).not.toHaveBeenCalled();
  });
  it("rejects alternate hosts and cross-origin reads before querying", async () => {
    enable();
    expect((await GET(request("", "attacker.example:4339"))).status).toBe(403);
    expect(
      (await GET(request("", "127.0.0.1:4339", "https://attacker.example")))
        .status,
    ).toBe(403);
    expect(readProductReport).not.toHaveBeenCalled();
  });
  it("never supplies fixtures or stale metrics when a query fails", async () => {
    enable();
    vi.mocked(readProductReport).mockRejectedValue(
      new Error("private SQL secret"),
    );
    const response = await GET(request()),
      body = await response.json();
    expect(response.status).toBe(503);
    expect(body.report).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("private SQL");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("requires explicit separate fixture mode", async () => {
    enable();
    expect((await GET(request("?data=sample"))).status).toBe(400);
    expect(readProductReport).not.toHaveBeenCalled();
  });
});
