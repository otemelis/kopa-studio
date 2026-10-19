import assert from "node:assert/strict";
import test from "node:test";
import { createAppleWebQueue } from "./apple-web-queue.js";

function fakeBrowser() {
  return {
    connected: true,
    isConnected() { return this.connected; },
    async close() { this.connected = false; },
  };
}

test("Apple web observations are serialized through the shared Chromium process", async () => {
  const browser = fakeBrowser();
  let active = 0;
  let peak = 0;
  const queue = createAppleWebQueue({
    browser,
    launchBrowser: async () => fakeBrowser(),
    collectObservation: async (_browser, _country, term) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return { status: "partial", ordered: [{ id: term }], depth: 1 };
    },
  });

  try {
    const results = await Promise.all(["a", "b", "c", "d"].map((term) => queue.observe("de", term)));
    assert.equal(peak, 1);
    assert.deepEqual(results.map((result) => result.ordered[0].id), ["a", "b", "c", "d"]);
  } finally {
    await queue.close();
  }
});

test("a closed Chromium process is restarted once and the affected observation is retried", async () => {
  let launches = 0;
  const firstBrowser = fakeBrowser();
  const queue = createAppleWebQueue({
    browser: firstBrowser,
    launchBrowser: async () => { launches++; return fakeBrowser(); },
    collectObservation: async (browser, _country, term) => {
      if (browser === firstBrowser) {
        await browser.close();
        return { status: "failed", error: "locator.evaluateAll: Target page, context or browser has been closed" };
      }
      return { status: "partial", ordered: [{ id: term }], depth: 1 };
    },
  });

  try {
    const recovered = await queue.observe("de", "keyword one");
    const following = await queue.observe("de", "keyword two");
    assert.equal(recovered.status, "partial");
    assert.equal(following.status, "partial");
    assert.equal(launches, 1);
  } finally {
    await queue.close();
  }
});
