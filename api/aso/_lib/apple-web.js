import { chromium as playwright } from "playwright-core";
import serverlessChromium from "@sparticuz/chromium";

const TIMEOUT_MS = 25_000;
const CHALLENGE = /captcha|access denied|unusual traffic|verify you are human|temporarily blocked/i;

export async function launchAppleWebBrowser() {
  serverlessChromium.setGraphicsMode = false;
  return playwright.launch({
    args: serverlessChromium.args,
    executablePath: await serverlessChromium.executablePath(),
    headless: true,
  });
}

export function classifyAppleWebCards(cards) {
  const seen = new Set();
  let organicPosition = 0;
  const ordered = [];
  for (const card of cards) {
    const id = String(card.id ?? "");
    if (!/^\d{6,}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const isAd = Boolean(card.explicitAd);
    const position = isAd ? null : ++organicPosition;
    ordered.push({ id, name: card.name ?? null, explicitAd: isAd, position });
  }
  const positions = Object.fromEntries(ordered.filter((row) => row.position != null).map((row) => [row.id, row.position]));
  const checksum = ordered.reduce((value, row) => (value * 31 + Number(row.id) % 997) % 1_000_000_007, 7).toString();
  return { ordered, positions, depth: organicPosition, explicitAdCount: ordered.filter((row) => row.explicitAd).length, checksum };
}

export async function collectAppleWebObservation(browser, country, term) {
  const context = await browser.newContext({
    locale: country === "de" ? "de-DE" : "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 1000 },
  });
  try {
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
    await page.waitForTimeout(1_800);
    const body = await page.evaluate(() => document.body?.innerText ?? "");
    if ((response?.status() ?? 0) >= 400 || CHALLENGE.test(body)) {
      return { status: "failed", depth: 0, positions: {}, explicitAdCount: 0, checksum: null, error: "Apple web search returned a block or challenge; no bypass or retry attempted." };
    }
    const cards = page.locator('section[data-test-id="shelf-wrapper"] li');
    let stablePasses = 0;
    let previousCount = 0;
    for (let pass = 0; pass < 10; pass++) {
      const currentCount = await cards.count();
      if (currentCount >= 100) break;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(600);
      const nextCount = await cards.count();
      stablePasses = nextCount === previousCount ? stablePasses + 1 : 0;
      previousCount = nextCount;
      if (stablePasses >= 2) break;
    }
    const rawCards = await cards.evaluateAll((items) => items.map((item) => {
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
    await context.close().catch(() => undefined);
  }
}
