const CLOSED_BROWSER = /target page, context or browser has been closed|browser has been closed/i;

const DEFAULT_OBSERVATION_TIMEOUT_MS = 25_000;
// The rankings-only function has a 300s platform limit. Leave 60s for iTunes
// persistence, final run/error writes, and lock release after the web queue.
const DEFAULT_BATCH_TIMEOUT_MS = 240_000;
const DEFAULT_CLOSE_TIMEOUT_MS = 1_000;

function failed(error) {
  return {
    status: "failed",
    depth: 0,
    ordered: [],
    positions: {},
    explicitAdCount: 0,
    checksum: null,
    error: error instanceof Error ? error.message : String(error),
  };
}

function withTimeout(promise, timeoutMs, message, onTimeout = null) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        onTimeout?.();
        reject(new Error(message));
      }, Math.max(1, timeoutMs));
    }),
  ]).finally(() => clearTimeout(timer));
}

async function closeBrowser(browser, timeoutMs) {
  if (!browser) return;
  let timer;
  const close = Promise.resolve().then(() => browser.close()).catch(() => undefined);
  await Promise.race([
    close,
    new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); }),
  ]);
  clearTimeout(timer);
}

/**
 * Serialize Apple web observations, isolate each keyword in its own Chromium
 * process, retry one browser-closure failure, and bound both the observation
 * and the whole batch so a wedged Playwright call cannot strand the cron lock.
 */
export function createAppleWebQueue({
  launchBrowser,
  collectObservation,
  maxBrowserLaunches = 21,
  observationTimeoutMs = DEFAULT_OBSERVATION_TIMEOUT_MS,
  batchTimeoutMs = DEFAULT_BATCH_TIMEOUT_MS,
  closeTimeoutMs = DEFAULT_CLOSE_TIMEOUT_MS,
}) {
  let launches = 0;
  let activeBrowser = null;
  let closed = false;
  let tail = Promise.resolve();
  const batchStartedAt = Date.now();

  const remainingBatchMs = () => batchTimeoutMs - (Date.now() - batchStartedAt);

  async function observeOne(country, term) {
    let lastError = "Apple web observation failed after one browser restart.";

    for (let attempt = 0; attempt < 2; attempt++) {
      if (closed) return failed("Apple web collection queue is closing.");
      const remaining = remainingBatchMs();
      if (remaining <= 0) return failed("Apple web batch time budget reached; remaining observations deferred to the next scheduled run.");
      if (launches >= maxBrowserLaunches) return failed("Apple web browser launch limit reached for this batch.");

      let browser = null;
      let launchExpired = false;
      try {
        launches++;
        const startup = Promise.resolve()
          .then(() => launchBrowser())
          .then(async (startedBrowser) => {
            if (launchExpired || closed) {
              await closeBrowser(startedBrowser, closeTimeoutMs);
              return null;
            }
            return startedBrowser;
          });
        browser = await withTimeout(
          startup,
          Math.min(20_000, remaining),
          "Apple web browser startup exceeded its time budget.",
          () => { launchExpired = true; },
        );
        if (!browser) return failed("Apple web collection queue closed during browser startup.");
        activeBrowser = browser;

        const observationBudget = Math.min(observationTimeoutMs, remainingBatchMs());
        if (observationBudget <= 0) return failed("Apple web batch time budget reached; remaining observations deferred to the next scheduled run.");

        const result = await withTimeout(
          collectObservation(browser, country, term),
          observationBudget,
          "Apple web observation exceeded its time budget.",
        );
        const browserClosed = result?.status === "failed" && CLOSED_BROWSER.test(result.error ?? "");
        if (!browserClosed || attempt > 0) return result;
        lastError = result.error;
      } catch (error) {
        if (browser === null) launchExpired = true;
        const message = error instanceof Error ? error.message : String(error);
        if (!CLOSED_BROWSER.test(message) || attempt > 0) return failed(message);
        lastError = message;
      } finally {
        await closeBrowser(browser, closeTimeoutMs);
        if (activeBrowser === browser) activeBrowser = null;
      }
    }

    return failed(lastError);
  }

  return {
    observe(country, term) {
      if (closed) return Promise.resolve(failed("Apple web collection queue is closed."));
      const next = tail.then(() => observeOne(country, term), () => observeOne(country, term));
      // Keep the serialized queue alive after a per-keyword failure.
      tail = next.catch(() => undefined);
      return next;
    },
    async close() {
      closed = true;
      // Close an in-flight browser first so pending Playwright operations fail
      // promptly instead of making shutdown wait on an unbounded queue tail.
      await closeBrowser(activeBrowser, closeTimeoutMs);
      await withTimeout(tail, closeTimeoutMs, "Apple web queue shutdown exceeded its time budget.").catch(() => undefined);
    },
  };
}
