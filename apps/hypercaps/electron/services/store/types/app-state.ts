import { z } from 'zod';
import { FeatureSchema } from './feature-config';

// Application-level settings
export const AppSettingsSchema = z.object({
  startupOnBoot: z.boolean(), // Launch with Windows
  startMinimized: z.boolean(), // Start in system tray
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// Complete application state
export const AppStateSchema = z.object({
  settings: AppSettingsSchema, // Application settings
  features: z.array(FeatureSchema), // Feature states
});

export type AppState = z.infer<typeof AppStateSchema>;
