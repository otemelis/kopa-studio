> Archived direction-review reference. The owner selected B · Signal. The actual Next implementation in `apps/tools` supersedes this buildless prototype; Product Analytics and theme work continue there.

# Kopa Studio — UX design review

Start with [review.html](review.html), an offline gallery linking both design directions, six primary screens, the keyword drawer, comparisons and edge states.

**Recommendation: A · Fieldwork.** B · Signal is a denser split-view alternative. Both use synthetic fixtures, not production performance. AppFollow and AppTweak were studied through current public documentation and illustrative screenshots; no authenticated vendor acceptance or owner usability victory is claimed.

- [10 UX review](docs/10_UX_REVIEW.md)
- [11 Design system](docs/11_UX_DESIGN_SYSTEM.md)
- [12 Screen specification](docs/12_UX_SCREEN_SPEC.md)
- [13 Implementation plan](docs/13_UX_IMPLEMENTATION_PLAN.md)
- [Verification and limits](docs/UX_VERIFICATION.md)
- [User directive](docs/UX_REDESIGN_DIRECTIVE.md)

Open the HTML in a browser, preserving this folder structure. Alternatively run `python3 -m http.server 4327 --bind 127.0.0.1` from this directory and visit `http://127.0.0.1:4327/review.html`. A loopback-only preview is retained for this owner review; the command above reproduces it if the session ends. No public application is deployed. Local notes/saved views stay in the browser's local storage. No runtime dependency install is needed.

Unit checks: `node --test prototype/analytics.test.cjs` (11 tests). This is disposable design scaffolding, not the production frontend architecture.

The roadmap now moves UX0 and UX1 ahead of implementation, then couples UX2 to validated backend sources and requires UX3 owner task comparison before legacy retirement. Visual/interaction approval is pending. Production code, data, credentials and backend contracts were not changed in this phase.
