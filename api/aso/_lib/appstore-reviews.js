import { fetchRecentReviews } from "./providers.js";

const TOPICS = [
  ["crash", /\b(crash|crashes|crashed|freeze|freezes|frozen|won't open|will not open)\b/i],
  ["performance", /\b(slow|lag|laggy|loading|buffering|performance)\b/i],
  ["login_account", /\b(login|log in|sign in|account|password|verification)\b/i],
  ["pricing_paywall", /\b(price|pricing|expensive|subscription|paywall|charged|refund)\b/i],
  ["ads", /\b(ad|ads|advert|advertisement)\b/i],
  ["usability", /\b(confusing|hard to use|interface|ui|navigation|usability)\b/i],
  ["content_feature", /\b(feature|features|content|missing|wish|request|add)\b/i],
  ["support", /\b(support|help|response|customer service)\b/i],
];

export function classifyReview(review) {
  const text = `${review.title ?? ""} ${review.body ?? ""}`;
  const topics = TOPICS.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
  return { topics, sentiment: review.rating <= 2 ? "negative" : review.rating >= 4 ? "positive" : "neutral" };
}

export async function syncRecentReviews(db, apps) {
  let fetched = 0;
  let imported = 0;
  for (const app of apps) {
    const reviews = await fetchRecentReviews(app.store_app_id, app.primary_country, 2);
    fetched += reviews.length;
    if (!reviews.length) continue;
    const rows = reviews.map((review) => ({
      app_id: app.id,
      review_ref: review.reviewRef,
      country: app.primary_country,
      rating: review.rating,
      title: review.title,
      body: review.body,
      author: review.author,
      version: review.version,
      language: null,
      reviewed_at: review.reviewedAt,
      developer_response: null,
      source: "public_store",
    }));
    const stored = await db.upsert("aso_reviews", rows, "app_id,review_ref");
    imported += stored.length;
    await db.upsert(
      "aso_review_classifications",
      stored.map((review) => ({
        review_id: review.id,
        ...classifyReview(review),
        method: "rules_v1",
        classified_at: new Date().toISOString(),
      })),
      "review_id",
    );
  }
  return { fetched, imported };
}
