# Apple Ads guardrails

Current state: Level 0 / read-only. No campaigns can be mutated.

The initial deterministic rule layer is implemented and tested. It refuses stale or partial data, requires evidence before exact harvesting, protects protected terms from automatic negative suggestions, and never enables a write operation.

The research planner is draft-only: it calculates total possible daily spend and always marks newly proposed campaigns as paused with approval required.

The first guardrail engine is implemented and tested. It blocks stale or partial data, emergency-paused accounts, unknown currency, bid-cap violations, daily hard-cap violations, and cooldown violations.

Future defaults remain conservative: no automatic budget increases, campaign activation, creation, deletion or broad negatives; approval for all bid increases and campaign/budget changes; freshness and complete-sync requirements; max bid-change/cooldown limits; global daily/monthly/research caps; emergency pause only after an explicit future write-mode design review. The most restrictive organization, app or campaign rule will win.
