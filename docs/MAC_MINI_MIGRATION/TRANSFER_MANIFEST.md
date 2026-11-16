# Non-Git transfer manifest

Git is the primary handover. The optional archive is a **sanitized template only**; no runtime credential or production data is included. The archive was built on 16 November 2026 at:

`/Users/otastemelis/Documents/Codex/kopa-mac-mini-non-git-transfer-2026-11-16.zip`

Archive size: 1,001 bytes. SHA-256:

```text
dccf266eff913de18fd1f2ddd7dd992bcee5bb9b06bad099961e7f04590bb199  kopa-mac-mini-non-git-transfer-2026-11-16.zip
```

| Archive entry | SHA-256 | Purpose |
| --- | --- | --- |
| `README.txt` | `cd4cf32509fdc7385a5b5d8debb32943084eb0b5df69e776eaf0773a71301942` | States the no-secret transfer boundary. |
| `kopa-tools.env.example` | `f9a255508da0e2c9b4171b7bf750414d8c60d5c74beb20a3bf5f8c29eb914987` | Empty variable-name template; values must be provisioned independently. |
| `SHA256SUMS.txt` | `cd0d8ce18e0b5c35dbd09b3b3f866c4731376037c6229f3fb9b5537f93ea76ab` | Checksums for the first two files. |

Python `zipfile.testzip()` returned no corrupt entry; the entry names and hashes were independently checked after archive creation. On the receiving Mac, verify `shasum -a 256 /path/to/kopa-mac-mini-non-git-transfer-2026-11-16.zip` before opening it. Copy it through the owner's chosen private transfer channel only if the empty template is useful. The same variable names are documented in [ENVIRONMENT.md](ENVIRONMENT.md), so the archive is **not required** to clone or test the project.

Excluded: `.env*` with values, `*.p8`, tokens, Supabase/Vercel auth caches, `.vercel`, private Keychain data, database exports, `node_modules`, `.next`, screenshots unrelated to collector startup, and all old-checkout uncommitted files. In particular the original checkout's uncommitted site/design work must be inventoried and reconciled through Git separately; nothing in this archive supersedes it.
