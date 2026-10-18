export const MAX_STORED_SEARCH_RESULTS = 100;

const SUPPORTED_SOURCES = new Set(["itunes_catalog", "apple_web_search"]);

export function classifyAppleWebCards(cards) {
  const seen = new Set();
  let organicPosition = 0;
  const ordered = [];
  for (const card of cards.slice(0, MAX_STORED_SEARCH_RESULTS)) {
    const id = String(card.id ?? "");
    if (!/^\d{6,}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const explicitAd = Boolean(card.explicitAd);
    const position = explicitAd ? null : ++organicPosition;
    ordered.push({ id, name: card.name ?? null, explicitAd, position });
  }
  const positions = Object.fromEntries(ordered.filter((row) => row.position != null).map((row) => [row.id, row.position]));
  const checksum = ordered.reduce((value, row) => (value * 31 + Number(row.id) % 997) % 1_000_000_007, 7).toString();
  return { ordered, positions, depth: organicPosition, explicitAdCount: ordered.filter((row) => row.explicitAd).length, checksum };
}

/**
 * Store a compact, ordered competitor observation without treating catalog
 * order or unlabeled web placements as verified organic rankings.
 */
export function buildKeywordSearchSnapshot(source, rows) {
  if (!SUPPORTED_SOURCES.has(source)) throw new Error(`Unsupported search result source: ${source}`);
  const observed = Array.isArray(rows) ? rows.slice(0, MAX_STORED_SEARCH_RESULTS) : [];
  let organicPosition = 0;
  const results = observed.map((row, index) => {
    const explicitAd = source === "apple_web_search" && row.explicitAd === true;
    const storeAppId = source === "apple_web_search" ? row.id : row.store_app_id;
    if (!/^\d{6,}$/.test(String(storeAppId ?? ""))) return null;
    if (!explicitAd) organicPosition += 1;

    if (source === "itunes_catalog") {
      return {
        observed_position: index + 1,
        store_app_id: String(storeAppId),
        name: row.name ?? null,
        developer: row.developer ?? null,
        classification: "catalog_result",
        catalog_position: Number.isInteger(row.position) ? row.position : index + 1,
        organic_position: null,
        explicit_ad: false,
      };
    }

    return {
      observed_position: index + 1,
      store_app_id: String(storeAppId),
      name: row.name ?? null,
      developer: row.developer ?? null,
      classification: explicitAd ? "ad" : "unclassified",
      catalog_position: null,
      organic_position: explicitAd ? null : (Number.isInteger(row.position) ? row.position : organicPosition),
      explicit_ad: explicitAd,
    };
  }).filter(Boolean);

  return {
    results,
    resultDepth: source === "apple_web_search"
      ? results.filter((row) => !row.explicit_ad).length
      : results.length,
  };
}
