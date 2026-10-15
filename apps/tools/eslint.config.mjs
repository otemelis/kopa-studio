import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
// Per-request clocks in async server reports are intentional, not client-render state.
const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    files: [
      "src/app/analytics/legacy-screen.tsx",
      "src/app/apple-ads-lab/keyword-intelligence/page.tsx",
    ],
    rules: { "react-hooks/purity": "off" },
  },
  {
    files: ["src/components/keyword-manager.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  { ignores: [".next/**", ".next-dev/**", "node_modules/**", "next-env.d.ts"] },
];
export default config;
