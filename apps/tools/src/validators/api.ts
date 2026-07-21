import { z } from "zod";

export const uuidParam = z.string().uuid();
export const paginationSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });
export const jobRequestSchema = z.object({ type: z.enum(["collection", "appstore_connect"]), appId: z.string().uuid().optional(), country: z.string().length(2).optional() });
export const jobStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);

const permittedTransitions: Record<z.infer<typeof jobStatusSchema>, z.infer<typeof jobStatusSchema>[]> = {
  queued: ["running", "cancelled"], running: ["completed", "failed", "cancelled"], completed: [], failed: ["queued"], cancelled: ["queued"],
};
export function canTransitionJob(from: z.infer<typeof jobStatusSchema>, to: z.infer<typeof jobStatusSchema>) { return permittedTransitions[from].includes(to); }
