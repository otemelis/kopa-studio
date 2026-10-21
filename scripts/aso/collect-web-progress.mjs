#!/usr/bin/env node
// Local, read-only Apple web collector for the small ASO progress set.
// --write appends source-tagged owned snapshots to the existing rank table.
// It stops on challenges and never treats uncertain cards as verified organic.
import { chromium } from "../../experiments/aso-web-itunes/native-comparison/node_modules/playwright/index.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serviceClient } from "../../api/aso/_lib/supabase.js";

const configArg = process.argv.find((arg) => arg.startsWith("--config="))?.slice("--config=".length);
const configPath = resolve(process.cwd(), configArg ?? "config/aso-monitoring.json");
const write = process.argv.includes("--write");
const config = JSON.parse(await readFile(configPath, "utf8"));
const db = write ? serviceClient() : null;
const timeoutMs = 30_000;

async function collect(page, country, term, storeAppId) {
  const url = new URL(`https://apps.apple.com/${country}/iphone/search`);
  url.searchParams.set("term", term);
  const response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForTimeout(3_000);
  const body = await page.evaluate(() => document.body?.innerText ?? "");
  if ((response?.status() ?? 0) >= 400 || /captcha|access denied|unusual traffic|verify you are human|temporarily blocked/i.test(body)) {
    return { status: "failed", depth: 0, position: null, checksum: null, error: "Apple web search returned a block or challenge; no bypass or retry attempted." };
  }
  const cards = page.locator('section[data-test-id="shelf-wrapper"] li');
  let stable = 0;
  let previous = 0;
  for (let pass = 0; pass < 12; pass++) {
    if (await cards.count() >= 100) break;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    const next = await cards.count();
    stable = next === previous ? stable + 1 : 0;
    previous = next;
    if (stable >= 2) break;
  }
  const results = await cards.evaluateAll((items) => items.flatMap((item) => {
    const link = item.querySelector('a[href*="/id"]');
    const id = link?.href.match(/\/id(\d+)/)?.[1] ?? null;
    if (!id) return [];
    const labels = [
      ...[...item.querySelectorAll("[aria-label], [title], [data-test-id], [data-testid]")].flatMap((node) => [node.getAttribute("aria-label"), node.getAttribute("title"), node.getAttribute("data-test-id"), node.getAttribute("data-testid")]),
      ...[...item.querySelectorAll("span, small, p")].map((node) => node.innerText?.trim()),
    ].filter(Boolean);
    const explicitAd = labels.find((value) => /^(ad|advertisement|sponsored|anzeige|gesponsert)$/i.test(value.trim())) ?? null;
    return [{ id, explicitAd: Boolean(explicitAd) }];
  }));
  let ordinal = 0;
  for (const result of results) result.position = result.explicitAd ? null : ++ordinal;
  const match = results.find((result) => result.id === String(storeAppId));
  const checksum = results.reduce((value, result) => (value * 31 + Number(result.id) % 997) % 1000000007, 7).toString();
  return { status: "partial", depth: ordinal, position: match?.position ?? null, checksum, explicitAdCount: results.filter((result) => result.explicitAd).length };
}

const observations = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const appTarget of config.apps) {
    let app = { name: appTarget.name, store_app_id: appTarget.storeAppId };
    let linkedTerms = new Map();
    if (write) {
      const apps = await db.select("aso_apps", `store_app_id=eq.${encodeURIComponent(appTarget.storeAppId)}&select=id,name,store_app_id`);
      app = apps[0];
      if (!app) throw new Error(`App Store ID ${appTarget.storeAppId} is not in aso_apps.`);
      const links = await db.select("aso_app_keywords", `app_id=eq.${app.id}&status=eq.active&select=keyword_id`);
      const ids = [...new Set(links.map((row) => row.keyword_id))];
      const keywordRows = ids.length ? await db.select("aso_keywords", `id=in.(${ids.join(",")})&select=id,term,country`) : [];
      linkedTerms = new Map(keywordRows.map((row) => [row.id, row]));
    }
    for (const [country, terms] of Object.entries(appTarget.countries)) {
      const configuredTerms = terms.map(({ keywordId, term }) => {
        if (!keywordId || !term) throw new Error(`Each configured term must include its checked keywordId and term (${country.toUpperCase()}).`);
        if (write) {
          const linked = linkedTerms.get(keywordId);
          if (!linked || linked.country !== country || linked.term.trim().toLocaleLowerCase() !== term.trim().toLocaleLowerCase()) {
            throw new Error(`Keyword ${term} (${keywordId}) is no longer active and linked to ${app.name} in ${country.toUpperCase()}.`);
          }
        }
        return { id: keywordId, term };
      });
      const context = await browser.newContext({ locale: country === "de" ? "de-DE" : "en-US", timezoneId: "Europe/Berlin", viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      try {
        for (const keyword of configuredTerms) {
          const { term } = keyword;
          const result = await collect(page, country, term, app.store_app_id);
          const capturedAt = new Date().toISOString();
          const row = {
            keyword_id: keyword.id,
            store_app_id: app.store_app_id,
            app_kind: "owned",
            captured_at: capturedAt,
            captured_on: capturedAt.slice(0, 10),
            collection_key: `web:${capturedAt.slice(0, 16)}:${keyword.id}:${app.store_app_id}`,
            rank: result.position,
            found: result.position != null,
            result_depth: result.depth,
            previous_rank: null,
            change_7d: null,
            change_30d: null,
            best_rank: null,
            collection_status: result.status,
            checksum: result.checksum,
            source: "apple_web_search",
          };
          observations.push({ app: app.name, keyword: term, country, source: "apple_web_search", capturedAt, position: row.rank, resultDepth: row.result_depth, status: row.collection_status, explicitAdCount: result.explicitAdCount ?? null, error: result.error ?? null, row });
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser?.close();
}

if (write) {
  const validRows = observations.filter((item) => item.status !== "failed").map((item) => item.row);
  if (validRows.length) await db.upsert("aso_keyword_rank_snapshots", validRows, "collection_key");
}
console.log(JSON.stringify({ mode: write ? "persisted_existing_rank_table" : "preview_only", source: "apple_web_search", count: observations.length, observations: observations.map(({ row, ...item }) => item) }, null, 2));
