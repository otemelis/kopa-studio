import collect from "./collect.js";

// Bounded rankings-only cron entrypoint. Authentication and locking remain in
// collect.js; the slot query parameter only makes scheduled invocations
// separately visible in Vercel's cron logs.
export default function handler(request, response) {
  request.asoCollectionScope = "rankings";
  return collect(request, response);
}
