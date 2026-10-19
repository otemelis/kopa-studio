import { chromium as playwright } from "playwright-core";
import serverlessChromium from "@sparticuz/chromium";
import { classifyAppleWebCards } from "./search-results.js";

// A single slow web response must not hold a scheduled ranking batch open.
// Unavailable observations are recorded as such and retried in a later slot.
const TIMEOUT_MS = 12_000;
const BROWSER_STARTUP_TIMEOUT_MS = 20_000;
const CHALLENGE = /captcha|access denied|unusual traffic|verify you are human|temporarily blocked/i;

export async function launchAppleWebBrowser() {
  serverlessChromium.setGraphicsMode = false;
  let timer;
  const startup = (async () => {
    const executablePath = await serverlessChromium.executablePath();
    return playwright.launch({
      args: serverlessChromium.args,
      executablePath,
      headless: true,
      timeout: BROWSER_STARTUP_TIMEOUT_MS,
    });
  })();
  try {
    return await Promise.race([
      startup,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Apple web browser startup exceeded 20 seconds.")), BROWSER_STARTUP_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    // If Chromium starts after the outer deadline, close it rather than leave
    // an orphaned browser process in the serverless invocation.
    startup.then((browser) => browser.close()).catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectAppleWebObservation(browser, country, term) {
  let context;
  try {
    context = await browser.newContext({
      locale: country === "de" ? "de-DE" : "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const url = new URL(`https://apps.apple.com/${encodeURIComponent(country)}/iphone/search`);
    url.searchParams.set("term", term);
    let response;
    try {
      response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    } catch (error) {
      const transient = /timeout|ECONNRESET|ENOTFOUND|ERR_TIMED_OUT/i.test(error instanceof Error ? error.message : String(error));
      if (!transient) throw error;
      // Retry a single transport timeout only. Challenge and access-control
      // responses are returned below without a retry or an evasion attempt.
      response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    }
    await page.waitForTimeout(500);
    const body = await page.evaluate(() => document.body?.innerText ?? "");
    if ((response?.status() ?? 0) >= 400 || CHALLENGE.test(body)) {
      return { status: "failed", depth: 0, positions: {}, explicitAdCount: 0, checksum: null, error: "Apple web search returned a block or challenge; no bypass or retry attempted." };
    }
    const cards = page.locator('section[data-test-id="shelf-wrapper"] li');
    let stablePasses = 0;
    let previousCount = 0;
    for (let pass = 0; pass < 8; pass++) {
      const currentCount = await cards.count();
      if (currentCount >= 100) break;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      const nextCount = await cards.count();
      stablePasses = nextCount === previousCount ? stablePasses + 1 : 0;
      previousCount = nextCount;
      if (stablePasses >= 2) break;
    }
    const rawCards = await cards.evaluateAll((items) => items.slice(0, 100).map((item) => {
      const link = item.querySelector('a[href*="/id"]');
      const id = link?.href.match(/\/id(\d+)/)?.[1] ?? null;
      const name = link?.innerText?.trim() || item.querySelector("h3")?.textContent?.trim() || null;
      const labels = [
        ...[...item.querySelectorAll("[aria-label], [title], [data-test-id], [data-testid]")].flatMap((node) => [node.getAttribute("aria-label"), node.getAttribute("title"), node.getAttribute("data-test-id"), node.getAttribute("data-testid")]),
        ...[...item.querySelectorAll("span, small, p")].map((node) => node.innerText?.trim()),
      ].filter(Boolean);
      const explicitAd = labels.some((value) => /^(ad|advertisement|sponsored|anzeige|gesponsert)$/i.test(value.trim()));
      return { id, name, explicitAd };
    }));
    const classified = classifyAppleWebCards(rawCards);
    if (!classified.ordered.length) {
      return { status: "failed", depth: 0, positions: {}, explicitAdCount: 0, checksum: null, error: "Apple search page loaded without identifiable result cards." };
    }
    return { status: "partial", ...classified, error: null };
  } catch (error) {
    return { status: "failed", depth: 0, positions: {}, explicitAdCount: 0, checksum: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await context?.close().catch(() => undefined);
  }
}
