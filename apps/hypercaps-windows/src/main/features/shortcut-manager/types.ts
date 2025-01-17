import { z } from 'zod'

// Zod validation schemas
export const KeyEventSchema = z.object({
  key: z.string(),
  type: z.enum(['press', 'release', 'hold']),
  timestamp: z.number(),
  duration: z.number().optional()
})

export const KeyboardFrameSchema = z.object({
  id: z.union([z.number(), z.string()]),
  frame: z.number(),
  timestamp: z.number(),
  justPressed: z.set(z.string()),
  heldKeys: z.set(z.string()),
  justReleased: z.set(z.string()),
  holdDurations: z.map(z.string(), z.number())
})

export const KeyboardStateSchema = z.object({
  key: z.string(),
  state: z.enum(['idle', 'justPressed', 'held', 'released']),
  initialPressTime: z.number(),
  holdDuration: z.number(),
  lastUpdateTime: z.number()
})

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
      strict: z.boolean().optional()
    })
    .optional()
})

export const TriggerPatternSchema = z.object({
  steps: z.array(TriggerStepSchema),
  window: z.number().optional(),
  totalTimeWindow: z.number().optional(),
  strict: z.boolean().optional()
})

export const ShortcutActionSchema = z.object({
  type: z.enum(['launch', 'command']),
  program: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional()
})

export const ShortcutSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: TriggerPatternSchema,
  action: ShortcutActionSchema,
  enabled: z.boolean(),
  cooldown: z.number().optional()
})

export const CommandSchema = z.object({
  id: z.string(),
  pattern: TriggerPatternSchema,
  cooldown: z.number().optional()
})

export const CommandMatchSchema = z.object({
  command: CommandSchema,
  events: z.array(KeyEventSchema),
  startTime: z.number(),
  endTime: z.number(),
  holdDurations: z.map(z.string(), z.number()).optional()
})

export const ShortcutManagerConfigSchema = z.object({
  isEnabled: z.boolean(),
  shortcuts: z.array(ShortcutSchema)
})

// Type inference from schemas
export type KeyEvent = z.infer<typeof KeyEventSchema>
export type KeyboardFrame = z.infer<typeof KeyboardFrameSchema>
export type KeyboardState = z.infer<typeof KeyboardStateSchema>
export type TriggerStep = z.infer<typeof TriggerStepSchema>
export type TriggerPattern = z.infer<typeof TriggerPatternSchema>
export type ShortcutAction = z.infer<typeof ShortcutActionSchema>
export type ShortcutActionType = ShortcutAction['type']
export type Shortcut = z.infer<typeof ShortcutSchema>
export type Command = z.infer<typeof CommandSchema>
export type CommandMatch = z.infer<typeof CommandMatchSchema>
export type ShortcutManagerConfig = z.infer<typeof ShortcutManagerConfigSchema>
export type ShortcutState = ShortcutManagerConfig
