# Dependency advisory evidence

Checked 2026-10-14 against baseline `189d42b6` after explicit user approval. No package installation, fix or lockfile mutation.

Registry summary: `{"critical": 3, "high": 11, "info": 0, "low": 0, "moderate": 1, "total": 15}`

Counts are affected dependency nodes, including transitive/development dependencies. They are not verified exploit counts. Runtime exposure and deployment configuration require assessment.

| Dependency | Locked version | Severity | Advisory details |
|---|---|---|---|
| @next/eslint-plugin-next | 15.5.20 | high | Transitive via fast-glob |
| @vitest/mocker | 3.2.7 | moderate | [Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) — affected `>=2.1.0 <4.1.11` |
| brace-expansion | 1.1.16 | high | [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — affected `<1.1.17`<br>[brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — affected `>=4.0.0 <5.0.8`<br>[brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — affected `>=4.0.0 <5.0.9`<br>[brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895) — affected `<1.1.18`<br>[brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — affected `<1.1.21`<br>[brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) — affected `>=4.0.0 <5.0.12`<br>[brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) — affected `<1.1.20`<br>[brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) — affected `>=4.0.0 <5.0.11`<br>[brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) — affected `<1.1.19`<br>[brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) — affected `>=4.0.0 <5.0.10` |
| braces | 3.0.3 | high | [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — affected `<=3.0.3` |
| eslint-config-next | 15.5.20 | high | Transitive via @next/eslint-plugin-next |
| fast-glob | 3.3.1 | high | Transitive via micromatch |
| js-yaml | 4.3.0 | high | [JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) — affected `>=4.0.0 <4.3.1`<br>[js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — affected `>=4.0.0 <4.3.2` |
| micromatch | 4.0.8 | high | Transitive via braces |
| nanoid | 3.3.16 | high | [nanoid: custom generators can loop indefinitely when size is zero](https://github.com/advisories/GHSA-2v37-7h3g-55p8) — affected `<3.3.18` |
| next | 15.5.20 | critical | [Next.js: Denial of Service in App Router using Server Actions](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) — affected `>=13.0.0 <15.5.21`<br>[Next.js: Server-Side Request Forgery in Server Actions on custom servers](https://github.com/advisories/GHSA-89xv-2m56-2m9x) — affected `>=14.1.1 <15.5.21`<br>[Next.js: Cache confusion of response bodies for requests with bodies](https://github.com/advisories/GHSA-68g3-v927-f742) — affected `>=13.0.0 <15.5.21`<br>[Next.js: Cache confusion of response bodies for requests with bodies containing invalid UTF-8 byte sequences](https://github.com/advisories/GHSA-4633-3j49-mh5q) — affected `>=13.0.0 <15.5.21`<br>[Next.js: Unbounded Server Action payload in Edge runtime](https://github.com/advisories/GHSA-4c39-4ccg-62r3) — affected `>=13.0.0 <15.5.21`<br>[Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) — affected `>=12.0.0 <15.5.21`<br>[Next.js: Denial of Service in the Image Optimization API using SVGs](https://github.com/advisories/GHSA-q8wf-6r8g-63ch) — affected `>=15.5.0 <15.5.21`<br>[Next.js: Unauthenticated disclosure of internal Server Function endpoints](https://github.com/advisories/GHSA-955p-x3mx-jcvp) — affected `>=13.0.0 <15.5.21`<br>[Next.js: Unauthenticated Remote Code Execution on windows-hosted servers](https://github.com/advisories/GHSA-p293-qw3h-jr36) — affected `>=13.4.0 <15.5.24`<br>[Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) — affected `>=10.0.0 <15.5.24`<br>[Next.js has cache poisoning of SSG and ISR pages in self-hosted applications](https://github.com/advisories/GHSA-4jqv-mc3x-m676) — affected `>=15.0.0 <15.5.27`<br>[Next.js has cache poisoning in SSG/ISR rendering that leads to cross-user content substitution and persistent denial of service](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) — affected `>=15.0.0 <15.5.27`<br>Transitive via postcss<br>Transitive via sharp |
| postcss | 8.5.20 | high | [PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) — affected `<8.5.10`<br>[PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q) — affected `<=8.5.11`<br>[PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) — affected `<=8.5.22`<br>[PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849) — affected `<=8.5.17` |
| sharp | 0.34.5 | high | [sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — affected `<0.35.0`<br>[sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) — affected `<0.35.4`<br>[sharp : Vulnerability in librsvg dependency CVE-2026-96889](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) — affected `<0.35.5` |
| source-map-js | 1.2.1 | high | [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) — affected `>=1.0.0 <1.2.2` |
| tinypool | 1.1.1 | critical | [Tinypool: Prototype Pollution gadget in worker options leads to Remote Code Execution](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) — affected `<=2.1.0`<br>[Tinypool: Prototype Pollution Gadget to RCE in run() options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) — affected `<2.1.2` |
| vitest | 3.2.7 | critical | Transitive via @vitest/mocker<br>[Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) — affected `>=2.1.0 <4.1.11`<br>Transitive via tinypool |

Automated `fixAvailable` is not an upgrade plan. Review compatible supported versions; do not apply forced major changes or downgrade Next tooling solely because npm suggests it.

## Key resolved versions

| Package | Version |
|---|---|
| next | 15.5.20 |
| react | 19.2.7 |
| react-dom | 19.2.7 |
| @supabase/supabase-js | 2.110.7 |
| @supabase/ssr | 0.7.0 |
| zod | 3.25.76 |
| typescript | 5.9.3 |
| vitest | 3.2.7 |
| eslint | 9.39.5 |
| tailwindcss | 4.3.3 |
