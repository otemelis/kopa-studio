# Apple Ads Lab architecture

The Lab is a read-only intelligence module built inside `apps/tools`, not a separate dashboard or campaign-management service.

```text
Apple Ads OAuth/API → versioned provider adapter → durable sync job → Supabase facts
                                                           ↓
ASO apps/rankings/metadata ───────────────→ deterministic joins/rules → compact Tool pages
                                                           ↓
                                             AI explanation (validated, no tool access)
```

Boundaries: the provider owns Apple endpoint and OAuth details; services orchestrate jobs; repositories own database queries; rule/model code produces calculated values; the AI can classify untrusted text and explain a deterministic conclusion but cannot calculate money, change eligibility, or invoke Apple APIs. Future write operations are a separate approval-copilot boundary with a re-fetch, guardrail check, idempotency key, audit record, execution and confirmation sequence.

Read-only mode is the only supported automation level. The initial adapter intentionally has no mutation methods.
