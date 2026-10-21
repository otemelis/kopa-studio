import { afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/signal/route";
afterEach(() => vi.unstubAllEnvs());
describe("Signal sample read boundary", () => {
  it("production never exposes fixtures even when both flags and URL request them", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KOPA_SIGNAL_FIXTURES", "1");
    const r = await GET(
      new NextRequest("http://localhost/api/signal?data=sample"),
    );
    expect(r.status).toBe(404);
  });
  it("development requires an explicit fixture flag and request", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("KOPA_SIGNAL_FIXTURES", "0");
    expect(
      (await GET(new NextRequest("http://localhost/api/signal?data=sample")))
        .status,
    ).toBe(404);
    vi.stubEnv("KOPA_SIGNAL_FIXTURES", "1");
    expect(
      (await GET(new NextRequest("http://localhost/api/signal"))).status,
    ).toBe(404);
  });
  it("JSON and CSV carry matching counts, identity, exact dates and definitions", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("KOPA_SIGNAL_FIXTURES", "1");
    const url =
      "http://localhost/api/signal?data=sample&area=funnels&app=innertype&identity=install";
    const json = await (await GET(new NextRequest(url))).json();
    const csv = await (await GET(new NextRequest(url + "&format=csv"))).text();
    expect(json.metadata.sample).toBe(true);
    expect(json.metadata.app).toBe("innertype");
    expect(json.rows.length).toBe(7);
    expect(csv).toContain("signal-v1");
    expect(csv).toContain("assessment_started");
    expect(csv).toContain(String(json.rows[0].count));
  });
  it("area metadata and rows identify the same report source", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("KOPA_SIGNAL_FIXTURES", "1");
    const result = await (
      await GET(
        new NextRequest(
          "http://localhost/api/signal?data=sample&area=keywords",
        ),
      )
    ).json();
    expect(result.metadata.source).toBe("Synthetic rank observations");
    expect(result.coverage.source).toBe(result.metadata.source);
    expect(
      result.rows.every(
        (r: { source: string }) => r.source === result.metadata.source,
      ),
    ).toBe(true);
  });
});
