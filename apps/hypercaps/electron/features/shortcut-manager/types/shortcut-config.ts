import { z } from 'zod';
import { TriggerPattern, TriggerPatternSchema } from './trigger-patterns';

export type ShortcutActionType = 'launch' | 'command';

export interface ShortcutAction {
  type: ShortcutActionType;
  program?: string; // For 'launch' type
  command?: string; // For 'command' type
  args?: string[]; // Optional arguments
}

export interface Shortcut {
  id: string;
  name: string;
  trigger: TriggerPattern;
  action: ShortcutAction;
  enabled: boolean;
  cooldown?: number; // Optional in interface, but required in state
}

export interface ShortcutManagerConfig {
  isEnabled: boolean;
  shortcuts: Shortcut[];
}

// Alias for backward compatibility
export type ShortcutState = ShortcutManagerConfig;

// Zod validation schemas
export const ShortcutActionSchema = z.object({
  type: z.enum(['launch', 'command']),
  program: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
});

export const ShortcutSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: TriggerPatternSchema,
  action: ShortcutActionSchema,
  enabled: z.boolean(),
  cooldown: z.number(), // Required in validation
});

export const ShortcutManagerConfigSchema = z.object({
  isEnabled: z.boolean(),
  shortcuts: z.array(ShortcutSchema),
});

// Alias for backward compatibility
export const ShortcutStateSchema = ShortcutManagerConfigSchema;
