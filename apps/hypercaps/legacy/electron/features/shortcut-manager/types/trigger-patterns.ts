import { z } from 'zod';

// Pattern matching types
export interface TriggerStep {
  type: 'press' | 'hold' | 'release' | 'combo' | 'single';
  keys: string[];
  holdTime?: number; // Direct property for hold duration
  window?: number; // Time window for this step
  strict?: boolean; // Whether keys must be pressed simultaneously
  conditions?: {
    // Optional additional conditions
    holdTime?: number;
    window?: number;
    strict?: boolean;
  };
}

export interface TriggerPattern {
  steps: TriggerStep[];
  window?: number; // Default window for all steps
  totalTimeWindow?: number; // Total time allowed for all steps
  strict?: boolean; // Default strict mode for all steps
}

// Command matching types
export interface Command {
  id: string;
  pattern: TriggerPattern;
  cooldown?: number;
}

export interface CommandMatch {
  command: Command;
  events: import('./keyboard-core').KeyEvent[];
  startTime: number;
  endTime: number;
  holdDurations?: Map<string, number>;
}

// Zod validation schemas
export const TriggerStepSchema = z.object({
  type: z.enum(['press', 'hold', 'release', 'combo', 'single']),
  keys: z.array(z.string()),
  holdTime: z.number().optional(),
  window: z.number().optional(),
  strict: z.boolean().optional(),
  conditions: z
    .object({
      holdTime: z.number().optional(),
      window: z.number().optional(),
      strict: z.boolean().optional(),
    })
    .optional(),
});

export const TriggerPatternSchema = z.object({
  steps: z.array(TriggerStepSchema),
  window: z.number().optional(),
  totalTimeWindow: z.number().optional(),
  strict: z.boolean().optional(),
});

export const CommandSchema = z.object({
  id: z.string(),
  pattern: TriggerPatternSchema,
  cooldown: z.number().optional(),
});
