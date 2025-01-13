import { z } from "zod";
import { HyperKeyFeatureConfigSchema } from "../../../features/hyperkeys/types/hyperkey-feature";

// Available features in HyperCaps
export const FeatureNameSchema = z.enum([
  "hyperKey", // Trigger key functionality
  "shortcutManager", // Coming soon
]);
export type FeatureName = z.infer<typeof FeatureNameSchema>;

// Feature-specific configurations
export const FeatureConfigSchema = z.object({
  hyperKey: HyperKeyFeatureConfigSchema,
  shortcutManager: z
    .object({
      // Will be expanded when implementing shortcut manager
      enabled: z.boolean(),
    })
    .optional(),
});
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;

// Generic feature structure
export const FeatureSchema = z.object({
  name: FeatureNameSchema,
  isFeatureEnabled: z.boolean(),
  enableFeatureOnStartup: z.boolean(),
  config: z.any(), // Typed through generic
});

export type Feature<T extends FeatureName> = {
  name: T;
  isFeatureEnabled: boolean;
  enableFeatureOnStartup: boolean;
  config: FeatureConfig[T];
};
