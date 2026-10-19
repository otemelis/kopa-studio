const CLOSED_BROWSER = /target page, context or browser has been closed|browser has been closed/i;

/** Serialize work through serverless Chromium and allow one browser restart per batch. */
export function createAppleWebQueue({ browser: initialBrowser = null, launchBrowser, collectObservation }) {
  let browser = initialBrowser;
  let launchAttempts = initialBrowser ? 1 : 0;
  let tail = Promise.resolve();

  async function ensureBrowser() {
    if (browser?.isConnected?.() === false) browser = null;
    if (browser) return browser;
    if (launchAttempts >= 2) throw new Error("Apple web browser restart limit reached for this batch.");
    launchAttempts++;
    browser = await launchBrowser();
    return browser;
  }

  async function run(country, term) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const currentBrowser = await ensureBrowser();
      try {
        const result = await collectObservation(currentBrowser, country, term);
        const closed = result?.status === "failed" && CLOSED_BROWSER.test(result.error ?? "");
        if (!closed || attempt > 0 || launchAttempts >= 2) return result;
        await currentBrowser.close().catch(() => undefined);
        if (browser === currentBrowser) browser = null;
      } catch (error) {
        const closed = CLOSED_BROWSER.test(error instanceof Error ? error.message : String(error));
        if (!closed || attempt > 0 || launchAttempts >= 2) throw error;
        await currentBrowser.close().catch(() => undefined);
        if (browser === currentBrowser) browser = null;
      }
    }
    return { status: "failed", depth: 0, positions: {}, explicitAdCount: 0, checksum: null, error: "Apple web observation failed after one browser restart." };
  }

  return {
    observe(country, term) {
      const next = tail.then(() => run(country, term), () => run(country, term));
      tail = next.catch(() => undefined);
      return next;
    },
    async close() {
      await tail;
      const current = browser;
      browser = null;
      await current?.close().catch(() => undefined);
    },
  };
}
