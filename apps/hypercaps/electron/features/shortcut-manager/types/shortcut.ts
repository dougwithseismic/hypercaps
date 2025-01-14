import { z } from "zod";

export type TriggerStepType = "combo" | "single";

export interface BufferConfig {
  window: number; // How long the buffer lasts in ms
  tapCount?: number; // How many taps needed (for single key steps)
  tapWindow?: number; // Max time between taps in ms
  holdTime?: number; // How long to hold for hold actions
}

export interface TriggerStep {
  type: TriggerStepType;
  keys: string[]; // Keys that must be pressed (together for combo, in sequence for single)
  timeWindow?: number; // Optional time window for this step in milliseconds
  buffer?: BufferConfig; // Optional buffer configuration for this step
}

export interface ShortcutTrigger {
  steps: TriggerStep[]; // Sequence of steps to complete
  totalTimeWindow?: number; // Optional overall time limit in milliseconds
  defaultBuffer?: BufferConfig; // Default buffer settings for all steps
}

export interface TriggerState {
  currentStep: number;
  stepStartTime: number;
  sequenceStartTime: number;
  pressedKeys: Set<string>;
  completedSteps: boolean[];
}

export interface Shortcut {
  id: string;
  name: string;
  trigger: ShortcutTrigger;
  action: ShortcutAction;
  enabled: boolean;
}

export type ShortcutActionType = "launch" | "command";

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
  type: z.enum(["combo", "single"]),
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
  type: z.enum(["launch", "command"]),
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
    shortcut: Omit<Shortcut, "id">;
  };
  removeShortcut: {
    id: string;
  };
  updateShortcut: {
    id: string;
    shortcut: Partial<Omit<Shortcut, "id">>;
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
