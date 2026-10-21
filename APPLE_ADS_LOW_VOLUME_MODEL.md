# Apple Ads low-volume model

The first deterministic implementation now preserves raw evidence, derives evidence stages, uses a beta-binomial posterior mean with configurable prior strength, and keeps confidence, financial risk and opportunity separate. It is intentionally conservative: one install is `INSTALL_EVIDENCE`, not repeated evidence.

Planned evidence stages: `NO_EVIDENCE`, `MARKET_SIGNAL_ONLY`, `IMPRESSION_EVIDENCE`, `TAP_EVIDENCE`, `INSTALL_EVIDENCE`, `POST_INSTALL_EVIDENCE`, and `REPEATED_EVIDENCE`. Unit tests will cover formulas, priors, scoring, caps and cooldowns before this drives recommendations.
