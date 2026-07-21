# Apple Ads reporting

The current owner-triggered report sync fetches a seven-day campaign-level daily window from Apple Ads and persists the returned daily rows. It filters the report to each imported campaign, keeps the raw daily source row, and updates an existing campaign/day record before inserting a new one. Base metrics include impressions, taps, installs, spend, average CPT and average CPA; rates are calculated consistently from their numerators and denominators.

The normalized `apple_ads_daily_metrics` migration and tested report parser/rate calculator are in place. They retain base counts/spend; presentation rates are derived rather than stored as the sole source of truth. A paused campaign with no delivery can validly return zero rows.

Search-term reporting is not a demand census: Apple applies a 10-impression threshold, and its report requests use `ORTZ`. The absence of a term is unknown, not zero. Impression share uses an asynchronous custom-report lifecycle and must retain report status, requested/available times and raw source fields.

The Lab now has a tested freshness classifier (`fresh`, `stale`, `missing`) and a strict eligibility gate that blocks any future write action unless data is fresh, complete, and currency is known.
