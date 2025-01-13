import { z } from "zod";

export const KeyMappingSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  triggers: z.array(z.string()),
  actionType: z.enum(["command", "shortcut", "script"]),
  action: z.string(),
  enabled: z.boolean(),
  options: z
    .object({
      workingDirectory: z.string().optional(),
      runAsAdmin: z.boolean().optional(),
      shell: z.string().optional(),
      async: z.boolean().optional(),
    })
    .optional(),
  metadata: z
    .object({
      createdAt: z.number(),
      lastModified: z.number(),
      lastUsed: z.number().optional(),
      useCount: z.number().optional(),
    })
    .optional(),
});

export type KeyMapping = z.infer<typeof KeyMappingSchema>;
