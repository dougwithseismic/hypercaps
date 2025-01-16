import { z } from 'zod';
import { HyperKeyFeatureConfigSchema } from '@electron/features/hyperkeys/types/hyperkey-feature';

// Available features in HyperCaps
export const FeatureNameSchema = z.enum([
  'hyperKey', // Trigger key functionality
  'shortcutManager', // Shortcut management
]);
export type FeatureName = z.infer<typeof FeatureNameSchema>;

// Define shortcut manager schema
export const ShortcutManagerConfigSchema = z.object({
  shortcuts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      triggerKey: z.string(),
      action: z.object({
        type: z.literal('launch'),
        program: z.string(),
      }),
      enabled: z.boolean(),
    })
  ),
  isEnabled: z.boolean(),
});

// Feature-specific configurations
export const FeatureConfigSchema = z.object({
  hyperKey: HyperKeyFeatureConfigSchema,
  shortcutManager: ShortcutManagerConfigSchema,
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
