# Mac mini setup (no live worker activation)

Use an administrator account only for installing software. Run Kopa under a separate standard macOS user; `launchd` jobs should run as that user. The Mac mini must have an active user login for `~/Library/LaunchAgents` after reboot. Do not enable auto-login merely to make jobs run; decide the unattended-login/security trade-off during cutover.

```sh
# On the receiving Mac, install Xcode Command Line Tools if absent.
xcode-select --install
# Install Homebrew from https://brew.sh if it is not already installed.
brew install node@24 python@3.13 git
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/opt/python@3.13/bin:$PATH"
node --version  # require v24.x for Vercel parity
python3 --version
git --version

mkdir -p "$HOME/Developer"
cd "$HOME/Developer"
git clone https://github.com/otemelis/kopa-studio.git
cd kopa-studio
git fetch origin
git switch main
git pull --ff-only
git log -1 --oneline
npm ci
npm run test:aso
npm run test:reporting
cd apps/tools
npm ci
npm run typecheck
npm test
npm run build
```

At the handover commit, `npm run test:aso` has one known stale assertion for five ranking slots while `vercel.json` has twelve. Do not reduce the live schedule to make the test pass; record the failure and repair that assertion in a separate reviewed code change. See [validation](VALIDATION.md).

Use the private Git account already configured on the Mac mini. The transfer archive is optional and contains **no** production credentials. No `.env` file is needed for the tests above. If `xcode-select --install` reports tools already installed, continue. If `brew` is missing, follow Homebrew's current installation instructions rather than pasting an unaudited installer from a message.

The root ranking collector currently imports `@sparticuz/chromium`, which supplies a serverless Chromium binary. A Mac-native worker must choose a locally installed Playwright Chromium executable and preserve the existing normal-browser behavior; do not assume the serverless binary runs on macOS. Install the Playwright browser only when implementing that worker, and test it with a **fixture/isolated** collector before any live collection. Do not run `npm run aso:web`, `npm run reports:refresh`, `npm run ads:refresh`, or the API handlers during base setup: they may make external requests or write local reporting output.

If a test unexpectedly needs environment variables, use synthetic/fixture values and investigate the test; do not solve it by copying the old Mac's `.env.local`. Version changes to Next.js or Supabase are outside Phase 1. `apps/tools/AGENTS.md` tells code-editing agents to consult the checked-out Next.js docs before changing that application.
