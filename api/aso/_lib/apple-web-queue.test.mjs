import assert from "node:assert/strict";
import test from "node:test";
import { createAppleWebQueue } from "./apple-web-queue.js";

function fakeBrowser() {
  return {
    connected: true,
    closeCalls: 0,
    isConnected() { return this.connected; },
    async close() { this.closeCalls++; this.connected = false; },
  };
}

const partial = (term) => ({ status: "partial", ordered: [{ id: term }], depth: 1 });

test("Apple web observations are serialized and use an isolated browser per keyword", async () => {
  const browsers = [];
  let active = 0;
  let peak = 0;
  const queue = createAppleWebQueue({
    launchBrowser: async () => {
      const browser = fakeBrowser();
      browsers.push(browser);
      return browser;
    },
    collectObservation: async (_browser, _country, term) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return partial(term);
    },
  });

  try {
    const terms = Array.from({ length: 10 }, (_, index) => `term-${index + 1}`);
    const results = await Promise.all(terms.map((term) => queue.observe("de", term)));
    assert.equal(peak, 1);
    assert.deepEqual(results.map((result) => result.ordered[0].id), terms);
    assert.equal(browsers.length, 10);
    assert.ok(browsers.every((browser) => browser.closeCalls === 1));
  } finally {
    await queue.close();
  }
});

test("Apple web queue forwards the recorded search locale", async () => {
  const observed = [];
  const queue = createAppleWebQueue({
    launchBrowser: async () => fakeBrowser(),
    collectObservation: async (_browser, country, term, locale) => {
      observed.push({ country, term, locale });
      return partial(term);
    },
  });
  try {
    await queue.observe("ca", "rappel de posture", "fr-CA");
    assert.deepEqual(observed, [{ country: "ca", term: "rappel de posture", locale: "fr-CA" }]);
  } finally {
    await queue.close();
  }
});

test("ten-keyword batches keep collecting after repeated browser crashes instead of cascading failures", async () => {
  const attemptsByTerm = new Map();
  let launches = 0;
  const queue = createAppleWebQueue({
    maxBrowserLaunches: 21,
    launchBrowser: async () => { launches++; return fakeBrowser(); },
    collectObservation: async (browser, _country, term) => {
      const attempts = attemptsByTerm.get(term) ?? 0;
      attemptsByTerm.set(term, attempts + 1);
      if (Number(term.slice(5)) > 2 && attempts === 0) {
        await browser.close();
        return { status: "failed", error: "browserContext.newPage: Target page, context or browser has been closed" };
      }
      return partial(term);
    },
  });

  try {
    const terms = Array.from({ length: 10 }, (_, index) => `term-${index + 1}`);
    const results = await Promise.all(terms.map((term) => queue.observe("de", term)));
    assert.deepEqual(results.map((result) => result.status), Array(10).fill("partial"));
    assert.equal(launches, 18, "eight per-keyword recoveries do not exhaust a batch-wide restart allowance");
  } finally {
    await queue.close();
  }
});

test("a full 48-keyword scheduled batch is not limited by the old batch-wide restart cap", async () => {
  let launches = 0;
  const terms = Array.from({ length: 48 }, (_, index) => `term-${index + 1}`);
  const queue = createAppleWebQueue({
    maxBrowserLaunches: 97,
    launchBrowser: async () => { launches++; return fakeBrowser(); },
    collectObservation: async (_browser, _country, term) => partial(term),
  });

  try {
    const results = await Promise.all(terms.map((term) => queue.observe("de", term)));
    assert.equal(results.length, 48);
    assert.ok(results.every((result) => result.status === "partial"));
    assert.equal(launches, 48);
  } finally {
    await queue.close();
  }
});

test("a browser-closure failure retries only that keyword and the following keywords continue", async () => {
  let launches = 0;
  let firstTermCalls = 0;
  const queue = createAppleWebQueue({
    launchBrowser: async () => { launches++; return fakeBrowser(); },
    maxBrowserLaunches: 6,
    collectObservation: async (browser, _country, term) => {
      if (term === "first" && firstTermCalls++ === 0) {
        await browser.close();
        return { status: "failed", error: "browserContext.newPage: Target page, context or browser has been closed" };
      }
      return partial(term);
    },
  });

  try {
    const results = await Promise.all(["first", "second", "third"].map((term) => queue.observe("de", term)));
    assert.deepEqual(results.map((result) => result.status), ["partial", "partial", "partial"]);
    assert.equal(launches, 4, "the failed term is relaunched once; each subsequent term gets an isolated browser");
  } finally {
    await queue.close();
  }
});

test("a hung Playwright observation times out, closes its browser, and does not strand the queue", async () => {
  let launches = 0;
  let firstBrowser;
  const queue = createAppleWebQueue({
    launchBrowser: async () => {
      launches++;
      const browser = fakeBrowser();
      if (!firstBrowser) firstBrowser = browser;
      return browser;
    },
    observationTimeoutMs: 15,
    batchTimeoutMs: 500,
    collectObservation: async (_browser, _country, term) => {
      if (term === "hung") return new Promise(() => {});
      return partial(term);
    },
  });

  try {
    const timedOut = await queue.observe("de", "hung");
    const following = await queue.observe("de", "following");
    assert.equal(timedOut.status, "failed");
    assert.match(timedOut.error, /exceeded its time budget/);
    assert.equal(firstBrowser.closeCalls, 1);
    assert.equal(following.status, "partial");
    assert.equal(launches, 2);
  } finally {
    await queue.close();
  }
});

test("batch deadline marks remaining observations unavailable without waiting for them", async () => {
  let launches = 0;
  const queue = createAppleWebQueue({
    launchBrowser: async () => { launches++; return fakeBrowser(); },
    batchTimeoutMs: 15,
    observationTimeoutMs: 100,
    collectObservation: async (_browser, _country, term) => {
      if (term === "slow") await new Promise((resolve) => setTimeout(resolve, 20));
      return partial(term);
    },
  });

  try {
    const first = await queue.observe("de", "slow");
    const second = await queue.observe("de", "deferred");
    assert.equal(first.status, "failed");
    assert.equal(second.status, "failed");
    assert.match(second.error, /batch time budget reached/);
    assert.equal(launches, 1);
  } finally {
    await queue.close();
  }
});

test("browser startup failures affect one keyword but do not stop later launch attempts", async () => {
  let launches = 0;
  const queue = createAppleWebQueue({
    maxBrowserLaunches: 3,
    launchBrowser: async () => {
      launches++;
      if (launches === 1) throw new Error("synthetic startup failure");
      return fakeBrowser();
    },
    collectObservation: async (_browser, _country, term) => partial(term),
  });

  try {
    const results = await Promise.all(["first", "second"].map((term) => queue.observe("de", term)));
    assert.equal(results[0].status, "failed");
    assert.match(results[0].error, /synthetic startup failure/);
    assert.equal(results[1].status, "partial");
    assert.equal(launches, 2);
  } finally {
    await queue.close();
  }
});
