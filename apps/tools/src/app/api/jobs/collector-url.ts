export function rankingCollectorUrl(configuredUrl?: string): URL {
  const endpoint = new URL(configuredUrl ?? "https://www.kopa.studio/api/aso/collect");
  const path = endpoint.pathname.replace(/\/+$/, "");
  if (path.endsWith("/collect")) {
    endpoint.pathname = `${path}-rankings`;
    endpoint.searchParams.delete("scope");
  } else {
    endpoint.searchParams.set("scope", "rankings");
  }
  return endpoint;
}
