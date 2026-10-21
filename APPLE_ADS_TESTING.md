# Apple Ads Lab testing

Milestone 1 tests must mock the OAuth token endpoint and ACL response, verify that secrets never appear in client output, and assert the adapter has no write method. A real read-only account test is a manual acceptance check. Future tests cover pagination, 429 retry/backoff, partial sync, idempotency, report validation, model formulas, guardrails, action approval and attribution fixtures; automated tests must never change a real Apple campaign.
