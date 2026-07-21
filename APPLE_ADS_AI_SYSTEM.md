# Apple Ads AI system

AI is reserved for semantic interpretation of untrusted keyword, search-term, app-metadata and competitor text. It receives explicit data-not-instructions framing, emits Zod-validated structured output, and stores provider/model/prompt/schema versions and input snapshots. It cannot call tools, calculate financial eligibility, bypass deterministic rules or execute Apple actions.

The strict keyword-analysis schema and prompt boundary are now implemented in `apps/tools/src/lib/apple-ads/keyword-analysis-schema.ts`.

Planned jobs are a search-term classifier, daily operational analyst, weekly strategic analyst and recommendation explainer. The rule engine remains the authoritative source for recommendation eligibility.
