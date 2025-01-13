import { z } from "zod";

export const HyperKeyFeatureConfigSchema = z.object({
  isHyperKeyEnabled: z.boolean(),
  trigger: z.string(),
  modifiers: z.array(z.string()),
  capsLockBehavior: z.enum(["None", "DoublePress", "BlockToggle"]).optional(),
});
export type HyperKeyFeatureConfig = z.infer<typeof HyperKeyFeatureConfigSchema>;
