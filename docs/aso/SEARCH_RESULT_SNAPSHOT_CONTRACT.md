# ASO search-result snapshots

Kopa stores compact, source-specific search observations in `aso_keyword_search_results`. Each row is keyed by keyword, UTC capture date, and source, so the iTunes catalog and Apple web observations remain separate and reruns replace only that source's daily observation.

Each snapshot retains at most the first 100 identifiable App Store IDs in the order returned by that source. The collector currently handles at most 12 keywords per ranking slot across five daily slots; with 231 tracked keyword pairs in the current database, complete coverage rotates over roughly four days. `result_depth` records the number of identifiable catalog entries for iTunes, or the number of identifiable non-ad web cards in the captured web slice. A shorter response stays shorter; Kopa does not fill missing positions.

Each item retains its observed slot and app ID. iTunes items use `catalog_position` and `classification: catalog_result`; this is catalog order, not native organic rank. Apple web items use `organic_position` only when the card is not explicitly labeled as an ad, and `classification` remains `unclassified` for unlabeled cards. Explicit ads are retained as `classification: ad`, with no organic position. Source and capture timestamp remain on the parent snapshot row.

These observations support later competitor presence and movement analysis within the same source. Agreement between sources is not treated as independent verification, and an app absent from a snapshot is only known to be absent within that source's captured depth.

The migration that allows same-day source-separated snapshots is `20261018154811_aso_source_separated_search_results.sql`. It is applied to the connected Supabase project; local tests do not apply migrations.
