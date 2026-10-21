import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const css = readFileSync(
  new URL("../../app/signal.css", import.meta.url),
  "utf8",
);
function luminance(hex: string) {
  const rgb = hex
    .replace("#", "")
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("Signal palette regression", () => {
  for (const theme of ["light", "dark"])
    it(
      theme + " text, tooltips and series preserve their contrast targets",
      () => {
        const compact = css.replace(/\s/g, "").replaceAll('"', "");
        const body =
          theme === "light"
            ? compact.match(/:root\{([^}]+)\}/)![1]
            : compact.match(/:root\[data-theme=dark\]\{([^}]+)\}/)![1];
        const tokens = Object.fromEntries(
          [
            ...body.matchAll(
              /(--[a-z0-9-]+):(#(?:[a-f0-9]{6}|[a-f0-9]{3}))(?=;|$)/g,
            ),
          ].map((m) => [
            m[1],
            m[2].length === 4
              ? "#" +
                m[2]
                  .slice(1)
                  .split("")
                  .map((c) => c + c)
                  .join("")
              : m[2],
          ]),
        );
        for (const surface of [
          "--sig-bg",
          "--sig-surface",
          "--sig-rail",
          "--sig-soft",
        ])
          for (const ink of [
            "--sig-ink",
            "--sig-muted",
            "--sig-accent",
            "--sig-positive",
            "--sig-negative",
            "--sig-warning",
          ])
            expect(
              contrast(tokens[ink], tokens[surface]),
              ink + " on " + surface,
            ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(tokens["--sig-tooltip"], tokens["--sig-tooltip-ink"]),
        ).toBeGreaterThanOrEqual(4.5);
        for (let i = 1; i <= 4; i++)
          expect(
            contrast(tokens["--series-" + i], tokens["--sig-surface"]),
          ).toBeGreaterThanOrEqual(3);
      },
    );
});
