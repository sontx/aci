import { z } from "zod";

export const userAppSchema = z.object({
  display_name: z.string().min(1, "Display name is required"),
  provider: z.string().min(1, "Provider is required"),
  version: z.string().min(1, "Version is required").default("1.0.0"),
  description: z.string().optional(),
  logo: z.string().url("Logo must be a valid URL").or(z.literal("")).optional(),
  categories: z.array(z.string()).optional(),
  active: z.boolean(),
});

export type UserAppFormData = z.infer<typeof userAppSchema>;
