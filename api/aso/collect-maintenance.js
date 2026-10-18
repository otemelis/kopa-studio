import collect from "./collect.js";

// Keeps slower metadata, review, App Store Connect, and insight refreshes out
// of the small ranking batches so Apple reporting delays cannot block ranks.
export default function handler(request, response) {
  request.asoCollectionScope = "maintenance";
  return collect(request, response);
}
