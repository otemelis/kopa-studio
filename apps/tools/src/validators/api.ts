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

const permittedTransitions: Record<z.infer<typeof jobStatusSchema>, z.infer<typeof jobStatusSchema>[]> = {
  queued: ["running", "cancelled"], running: ["completed", "failed", "cancelled"], completed: [], failed: ["queued"], cancelled: ["queued"],
};
export function canTransitionJob(from: z.infer<typeof jobStatusSchema>, to: z.infer<typeof jobStatusSchema>) { return permittedTransitions[from].includes(to); }
