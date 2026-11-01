export type ListingCoverage = "name" | "description" | "not_visible" | "unavailable";

function words(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function containsPhrase(haystack: string, phrase: string) {
  const target = words(phrase);
  if (!target.length) return false;
  const source = words(haystack);
  return source.some((_, index) => target.every((word, offset) => source[index + offset] === word));
}

export function listingCoverage(term: string, listing: { name: string; description: string | null } | null): ListingCoverage {
  if (!listing) return "unavailable";
  if (containsPhrase(listing.name, term)) return "name";
  if (containsPhrase(listing.description ?? "", term)) return "description";
  return "not_visible";
}

export function listingCoverageLabel(value: ListingCoverage) {
  switch (value) {
    case "name": return "In app name";
    case "description": return "Description only";
    case "not_visible": return "Not in visible copy";
    case "unavailable": return "Listing unavailable";
  }
}
