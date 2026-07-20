// Apple public store provider — lookup, keyword search rankings, and recent
// public customer reviews. The review feed is rate-limited through the same
// polite queue as all other public Apple requests.
//
// Low request rate, in-memory caching, retries with exponential backoff, a
// descriptive user agent, no scraping tricks. Honest limitation: iTunes
// Search ordering is closely related to, but not identical with, on-device
// App Store search — callers must label rankings as a storefront snapshot.

const USER_AGENT = "KopaASOIntelligence/1.0 (personal portfolio ASO tool; contact: hello@kopa.studio)";
const MIN_INTERVAL_MS = 3200; // ≈18 requests/min, under Apple's ~20/min guidance
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_RETRIES = 3;

const cache = new Map();
let queueTail = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeFetchJson(url) {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.body;

  const myTurn = queueTail.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });
  queueTail = myTurn.catch(() => undefined);
  await myTurn;

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { permanent: true });
      const body = await res.json();
      cache.set(url, { expires: Date.now() + CACHE_TTL_MS, body });
      return body;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (lastError.permanent) break;
      if (attempt < MAX_RETRIES) await sleep(1000 * 2 ** attempt + Math.random() * 500);
    }
  }
  throw lastError ?? new Error("fetch failed");
}

function mapLookupResult(r) {
  return {
    store_app_id: String(r.trackId),
    bundle_id: r.bundleId ?? null,
    name: r.trackName ?? "",
    subtitle: null, // iTunes lookup doesn't return the App Store subtitle
    developer: r.artistName ?? null,
    description: r.description ?? null,
    icon_url: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
    category: r.primaryGenreName ?? null,
    current_version: r.version ?? null,
    release_notes: r.releaseNotes ?? null,
    rating: typeof r.averageUserRating === "number" ? Math.round(r.averageUserRating * 100) / 100 : null,
    rating_count: r.userRatingCount ?? null,
    price: typeof r.price === "number" ? r.price : null,
    currency: r.currency ?? null,
    store_url: r.trackViewUrl ?? null,
    languages: Array.isArray(r.languageCodesISO2A) ? r.languageCodesISO2A : null,
    screenshot_urls: Array.isArray(r.screenshotUrls) ? r.screenshotUrls : null,
    last_store_update_at: r.currentVersionReleaseDate ?? null,
  };
}

export async function lookupApp(storeAppId, country) {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(storeAppId)}&country=${encodeURIComponent(country)}&entity=software`;
  const body = await politeFetchJson(url);
  const r = body?.results?.[0];
  if (!r || r.trackId == null) return null;
  return mapLookupResult(r);
}

export async function searchApps(term, country, limit) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${encodeURIComponent(country)}&entity=software&limit=${Math.min(limit, 200)}`;
  const body = await politeFetchJson(url);
  const results = Array.isArray(body?.results) ? body.results : [];
  return results
    .filter((r) => r.trackId != null)
    .map((r, i) => ({
      position: i + 1,
      store_app_id: String(r.trackId),
      name: r.trackName ?? "",
      developer: r.artistName ?? null,
      rating: typeof r.averageUserRating === "number" ? Math.round(r.averageUserRating * 100) / 100 : null,
      rating_count: r.userRatingCount ?? null,
    }));
}

function label(value) {
  return typeof value === "string" ? value : value?.label ?? null;
}

export function parseCustomerReviewFeed(body) {
  const entries = Array.isArray(body?.feed?.entry) ? body.feed.entry : [];
  return entries
    .filter((entry) => label(entry["im:rating"]) != null)
    .map((entry) => {
      const rating = Number(label(entry["im:rating"]));
      const reviewRef = label(entry.id);
      const reviewedAt = label(entry.updated);
      if (!reviewRef || !reviewedAt || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
      return {
        reviewRef,
        rating,
        title: label(entry.title),
        body: label(entry.content) || label(entry.title) || "(No written review)",
        author: label(entry.author?.name),
        version: label(entry["im:version"]),
        reviewedAt,
      };
    })
    .filter(Boolean);
}

export async function fetchRecentReviews(storeAppId, country, pages = 2) {
  const reviews = new Map();
  for (let page = 1; page <= pages; page++) {
    const url = `https://itunes.apple.com/${encodeURIComponent(country)}/rss/customerreviews/page=${page}/id=${encodeURIComponent(storeAppId)}/sortby=mostrecent/json`;
    const body = await politeFetchJson(url);
    const rows = parseCustomerReviewFeed(body);
    for (const row of rows) reviews.set(row.reviewRef, row);
    if (rows.length === 0) break;
  }
  return [...reviews.values()];
}

/** Parse an App Store URL or a bare numeric id into a store app id. */
export function parseAppleAppId(input) {
  const trimmed = input.trim();
  if (/^\d{6,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id(\d+)/i);
  return match ? match[1] : null;
}
