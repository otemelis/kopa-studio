# M6 weekly Apple Ads comparisons · 17 October 2026

Open http://127.0.0.1:4340/apple-ads.html and choose a **7 days** option in the existing reporting-window selector. Four complete weeks now reuse the current metrics/table and Signal themes. Existing full-window, daily and official console options remain. No new chart, layout, backend, provider call or production deployment.

The source remains the owner-saved 17 September–14 October export, queried 15 October 19:25 UTC. Republishing locally does not make it live. One of three mapped campaigns has observed rows; the other two remain Not reported. These are observed Apple Ads-attributed installs, not App Store Connect downloads, paying customers or revenue.

| Week (UTC) | Exact observed EUR spend | Total attributed installs |
|---|---:|---:|
| 17–23 September | 3.7593 | 8 |
| 24–30 September | 1.9878 | 2 |
| 1–7 October | 1.3351 | 1 |
| 8–14 October | 0.4918 | 0 |

Example: 8–14 October versus 1–7 October reports **EUR -0.8433** exact spend and **-1 attributed install**, for the one campaign with complete daily observations in both weeks. This is not an account-wide trend or a scaling recommendation. The source is small, historical and lacks paying-customer attribution.

Comparison rules: the same observed campaign set must have all seven days in both windows. Different observed sets, missing days, no observations or an out-of-source prior period make comparison unavailable. Two absent campaigns are not filled with zero. The earliest week has no prior comparison. Spend differences are calculated at original decimal precision, so they can differ from subtraction of individually rounded displayed amounts. CPA remains unavailable with no attributed installs. No percentage change or universal ROAS is invented.

External controls remain only 11 October and the 11–14 October period aggregate. The latest week contains those control subwindows, but has no independent full-week console control. Earlier weeks have no supplied console control wholly inside them. These limitations are visible in the existing source-quality paragraph.

Verification: 14 Apple Ads regression tests pass. Independent Python CSV/Decimal reconciliation checks all 33 API windows and four weekly comparison contracts against the original saved JSON; the two original console controls still pass. Independent DOM/source reconciliation checks 104 metric cells and four comparison states across the weekly views. Existing light/dark styles were checked and dark restored. Original source CSV/JSON and daily CSV remain unchanged.

Reproduce with the existing commands:

```sh
node scripts/apple-ads-verification/publish-api.mjs /path/export11.json /path/one-day.csv /path/four-day.csv
python3 scripts/apple-ads-verification/reconcile-api.py /path/export11.json /path/one-day.csv /path/four-day.csv
node --test scripts/apple-ads-verification/*.test.mjs
```

Next independent source decision: M7 should proceed only for a channel with actual spend and an official export/access. Without that evidence, no Meta/Google/TikTok integration or attribution layer is justified. Apple Analytics generation and PASSPORT device checks remain pending independently.
