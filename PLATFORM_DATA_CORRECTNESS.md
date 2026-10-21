# Platform data correctness

## Principles

- Preserve source data and raw payloads wherever possible.
- Prefer additive migrations.
- Treat generated recommendations as read-only evidence until explicitly approved.
- Keep user-facing empty states honest when external systems have not delivered data yet.
- Do not infer Apple Ads account state from names when the API provides explicit fields.

## Apple Ads correctness

### Search Match

Search Match is mapped from Apple Ads API v5 `automatedKeywordsOptIn`.

For previously imported ad-group rows, the read model can fall back to the preserved raw payload. This avoids treating missing normalized columns as false negatives.

### Campaign structure

Imported structure includes:

- Campaigns
- Ad groups
- Targeting keywords
- Negative keywords

The integration remains read-only. No local route modifies Apple Ads account structure.

### Reporting

Daily campaign reporting uses idempotent lookup/update logic instead of relying only on a compound unique key with nullable fields.

Search-term reporting stores:

- Search term
- Source keyword text
- Match source
- Campaign/ad group/keyword links when available
- Country
- Date
- Impressions, taps, installs, spend and currency
- Raw payload

Search-term rows are also idempotently updated by explicit lookup fields.

### Recommendations

Apple Ads recommendation records are generated from imported evidence only.

Current recommendation safeguards:

- Blocks stale data.
- Blocks partial syncs.
- Skips terms already covered by exact keywords.
- Skips terms already covered by exact negatives.
- Stores decision snapshots separately from recommendation rows.
- Keeps all actions read-only; no Apple Ads mutation API exists.

## ASO and market correctness

Current consolidation work has not removed the existing ASO data paths. The global context bar now carries app, market and period selections, but deeper repository-level filtering still needs to be completed for some pages.

Known areas requiring future validation:

- Localization readiness model.
- App Store Connect report parser behavior on malformed or partial reports.
- Unified keyword query across rankings and tracked keyword rows.
- Cross-market duplicate detection beyond Apple Ads campaign structure.

## Testing coverage

Covered by focused tests:

- Metrics aggregation.
- API validators.
- Apple Ads status normalization.
- Apple Ads Search Match mapping.
- Apple Ads keyword structure intelligence.
- Apple Ads reporting parser.
- Apple Ads search-term parser.
- Apple Ads search-term repository read model.
- Apple Ads recommendation rules.
- Apple Ads search-term recommendation decisions.
- Recommendation quality constraints.

## Known gaps

- No browser E2E suite yet for authenticated workspace navigation.
- No integration test yet for global context flowing into every repository query.
- Production validation still depends on deployed credentials and real Apple Ads delivery.
- `npm run lint` is blocked by missing ESLint flat config.

## Safety status

Automation Level 0 remains in force.

Allowed:

- Read Apple Ads account data.
- Store imported data locally.
- Generate local recommendations.

Not allowed:

- Create campaigns.
- Edit campaigns.
- Create or edit ad groups.
- Create or edit keywords.
- Create or edit negatives.
- Change budgets or bids.
