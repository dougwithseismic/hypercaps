import { z } from "zod";
import { HyperKeyFeatureConfigSchema } from "../../../features/hyperkeys/types/hyperkey-feature";

export const TestFeatureConfigSchema = z.object({
  testSetting: z.string(),
});
export type TestFeatureConfig = z.infer<typeof TestFeatureConfigSchema>;

export const FeatureConfigSchema = z.object({
  hyperKey: HyperKeyFeatureConfigSchema,
  test: TestFeatureConfigSchema,
});
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;

export const FeatureNameSchema = z.enum(["hyperKey", "test"]);
export type FeatureName = z.infer<typeof FeatureNameSchema>;

export const FeatureSchema = z.object({
  name: FeatureNameSchema,
  enableOnStartup: z.boolean(),
  isFeatureEnabled: z.boolean(),
  config: z.any(), // This will be properly typed through the generic
});

export type Feature<T extends FeatureName> = {
  name: T;
  enableOnStartup: boolean;
  isFeatureEnabled: boolean;
  config: FeatureConfig[T];
};
