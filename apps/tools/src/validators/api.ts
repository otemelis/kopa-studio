import { z } from "zod";

export const uuidParam = z.string().uuid();
export const paginationSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });
export const jobRequestSchema = z.object({ type: z.enum(["collection", "appstore_connect"]), appId: z.string().uuid().optional(), country: z.string().length(2).optional() });
export const jobStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);
export const countrySchema = z.string().trim().toLowerCase().regex(/^[a-z]{2}$/, "Use a two-letter App Store storefront code.");
export const prioritySchema = z.enum(["high", "medium", "low"]);
export const createAppSchema = z.object({ input: z.string().trim().min(3).max(500), country: countrySchema.default("us") });
export const createKeywordSchema = z.object({ appId: uuidParam, terms: z.array(z.string().trim().min(2).max(100)).min(1).max(25), country: countrySchema, priority: prioritySchema.default("medium") });
export const updateKeywordSchema = z.object({ term: z.string().trim().min(2).max(100), country: countrySchema, priority: prioritySchema, status: z.enum(["active", "paused"]).default("active") });
export const createCompetitorSchema = z.object({ appId: uuidParam, input: z.string().trim().min(3).max(500), country: countrySchema.default("us") });
export const insightActionSchema = z.object({ action: z.enum(["completed", "dismissed", "snoozed"]) });
const experimentStatusSchema = z.enum(["planned", "running", "monitoring", "won", "lost", "inconclusive", "reverted"]);
const metricSchema = z.enum(["impressions", "page_views", "downloads", "conversion"]);
export const experimentSchema = z.object({ appId: uuidParam, title: z.string().trim().min(3).max(160), hypothesis: z.string().trim().max(1000).nullable().optional(), changeType: z.string().trim().min(2).max(80), country: z.union([countrySchema, z.literal("all")]).default("all"), targetMetric: metricSchema.default("conversion"), startDate: z.string().date().nullable().optional(), status: experimentStatusSchema.default("planned"), result: z.string().trim().max(1000).nullable().optional(), conclusion: z.string().trim().max(2000).nullable().optional(), nextAction: z.string().trim().max(1000).nullable().optional() });
export const appleAdsConnectionSchema = z.object({ appleAdsOrgId: z.string().trim().min(1).max(64), appleAdsOrgName: z.string().trim().min(1).max(200), currency: z.string().trim().length(3).toUpperCase().optional(), timezone: z.string().trim().min(1).max(100).optional() });
export const appleAdsAppMappingSchema = z.object({ connectionId: uuidParam, appId: uuidParam, adamId: z.string().trim().regex(/^\d+$/, "Adam ID must contain digits only.").max(32), appleAppName: z.string().trim().min(1).max(200).optional() });

const permittedTransitions: Record<z.infer<typeof jobStatusSchema>, z.infer<typeof jobStatusSchema>[]> = {
  queued: ["running", "cancelled"], running: ["completed", "failed", "cancelled"], completed: [], failed: ["queued"], cancelled: ["queued"],
};
export function canTransitionJob(from: z.infer<typeof jobStatusSchema>, to: z.infer<typeof jobStatusSchema>) { return permittedTransitions[from].includes(to); }
