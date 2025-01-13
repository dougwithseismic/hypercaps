import { z } from "zod";
import { FeatureSchema } from "./feature-config";

export const AppStateSchema = z.object({
  startupOnBoot: z.boolean(),
  enableOnStartup: z.boolean(),
  features: z.array(FeatureSchema),
});

export type AppState = z.infer<typeof AppStateSchema>;
