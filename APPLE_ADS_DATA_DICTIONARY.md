# Apple Ads Lab data dictionary

Milestone 1 adds `apple_ads_connections` (non-secret provider, ACL, permission, health and freshness metadata) and `apple_ads_app_mappings` (connection-to-`aso_apps` Adam-ID mapping). Both are service-role-only tables with RLS enabled.

Future facts will be additive: structure tables retain raw source payloads and source timestamps; daily metrics retain base counts and spend rather than only rates; search terms retain first/last seen, source, classification and harvest/negative state; decision snapshots retain immutable model inputs; actions retain before/after state, approvals and idempotency keys. Existing ASO data remains canonical in the `aso_*` tables described in `DATABASE_SCHEMA.md`.
