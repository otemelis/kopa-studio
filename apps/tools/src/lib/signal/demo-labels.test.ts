import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductViews } from "@/components/signal/product-views";
import { parseScope } from "./contracts";
import { buildSampleSnapshot } from "./snapshot";
describe("demo source identity", () => {
  it("reproduces the screenshot as generated fixture data and labels the funnel inside its panel", () => {
    const scope = parseScope(
      new URLSearchParams(
        "app=innertype&country=DE&start=2026-09-17&end=2026-10-11&identity=session&tab=funnels&data=sample",
      ),
    );
    const data = buildSampleSnapshot(scope);
    expect(data.funnel.map((r) => r.count)).toEqual([
      96, 96, 72, 48, 48, 24, 24,
    ]);
    const html = renderToStaticMarkup(
      createElement(ProductViews, { data, patch: () => {}, inspect: () => {} }),
    );
    expect(html).toContain("DEMO METRICS — GENERATED EXAMPLES");
    expect(html).toContain("sig-demo-tag");
    expect(html).toContain("DEMO · SYNTHETIC DATA");
    expect(html).not.toContain("Complete fixture window");
  });
});
