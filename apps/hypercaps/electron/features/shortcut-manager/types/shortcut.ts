import { z } from 'zod';

export type TriggerStepType = 'single' | 'combo' | 'hold';

export interface BufferConfig {
  window?: number;
  tapCount?: number;
  tapWindow?: number;
  holdTime?: number;
}

export interface TriggerStep {
  type: TriggerStepType;
  keys: string[];
  holdTime?: number; // Duration in ms for hold-type steps
  window?: number; // Time window in ms for this step
}

export interface ShortcutTrigger {
  steps: TriggerStep[];
  totalTimeWindow?: number;
  defaultBuffer?: BufferConfig;
}

export interface TriggerState {
  currentStep: number;
  stepStartTime: number;
  sequenceStartTime: number;
  pressedKeys: Set<string>;
  completedSteps: boolean[];
  holdStartTimes: Map<string, number>;
}

export interface Shortcut {
  id: string;
  name: string;
  trigger: ShortcutTrigger;
  action: ShortcutAction;
  enabled: boolean;
  cooldown?: number; // Optional cooldown in milliseconds
}

export type ShortcutActionType = 'launch' | 'command';

export interface ShortcutAction {
  type: ShortcutActionType;
  program?: string; // For 'launch' type
  command?: string; // For 'command' type
  args?: string[]; // Optional arguments
}

// Zod schemas for validation
export const BufferConfigSchema = z.object({
  window: z.number(),
  tapCount: z.number().optional(),
  tapWindow: z.number().optional(),
  holdTime: z.number().optional(),
});

export const TriggerStepSchema = z.object({
  type: z.enum(['combo', 'single', 'hold']),
  keys: z.array(z.string()),
  timeWindow: z.number().optional(),
  buffer: BufferConfigSchema.optional(),
});

export const ShortcutTriggerSchema = z.object({
  steps: z.array(TriggerStepSchema),
  totalTimeWindow: z.number().optional(),
  defaultBuffer: BufferConfigSchema.optional(),
});

export const ShortcutActionSchema = z.object({
  type: z.enum(['launch', 'command']),
  program: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
});

export const ShortcutSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: ShortcutTriggerSchema,
  action: ShortcutActionSchema,
  enabled: z.boolean(),
});

export interface ShortcutState {
  shortcuts: Shortcut[];
  isEnabled: boolean;
}

export interface ShortcutCommands {
  addShortcut: {
    shortcut: Omit<Shortcut, 'id'>;
  };
  removeShortcut: {
    id: string;
  };
  updateShortcut: {
    id: string;
    shortcut: Partial<Omit<Shortcut, 'id'>>;
  };
  toggleEnabled: {
    enabled: boolean;
  };
  getState: void;
}

export interface ShortcutEvents {
  stateChanged: ShortcutState;
  shortcutTriggered: {
    shortcut: Shortcut;
    timestamp: number;
  };
}

export type ShortcutManagerService = {
  commands: ShortcutCommands;
  events: ShortcutEvents;
};
