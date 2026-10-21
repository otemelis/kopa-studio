# Working source comparison

Open http://127.0.0.1:4340/keyword-evidence.html. Uses the real supplied AppFollow InnerType DE/iPhone export and 30 retained Supabase observations. Fourteen selectable keyword histories show actual gaps, not-found states and both series without interpolation. This is a manual historical comparison, not a live native rank tracker. Existing Signal themes are reused.

Run `node --test scripts/aso-feasibility/*.test.mjs`: seven pass (four import boundary tests and three diagnostic reproductions). The import rejects wrong market/device, duplicate keywords, zero/unknown rank tokens and inconsistent current-position controls. Original source SHA-256: `64ef7b4affaedce8a1c4bc22d5781da397f9ed9817e44ef2d7763d7ce720e5f7`. The original file remains unchanged.

Generate with `node scripts/aso-feasibility/compare-appfollow.mjs /absolute/appfollow.csv reporting/portfolio/keyword-evidence.json`. No database writes or vendor API calls. Scope is deliberately the validated seven-day DE/iPhone InnerType slice; other export shapes/scopes require a separately validated mapping, not silently relabeled data. The stored extract is immutable evidence for this checkpoint; `VERIFY_HISTORY.sql` reproduces it. Independent Python CSV iteration verified the original hash, 14 keywords, all 98 daily cells, 30 distinct source keys and all five comparison counts (2/13/10/68/5). Existing 15 reporting tests still pass.

Browser checked keyword switching, both themes and missing rows. Source titles/device/language/time/depth limitations are visible. The comparison is a useful source-validation capability; automated tracking remains gated. See DECISION.md and ../m6/PREFLIGHT.md for exact next actions.
