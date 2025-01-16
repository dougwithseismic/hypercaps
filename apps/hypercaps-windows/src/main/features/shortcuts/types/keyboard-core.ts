import { z } from 'zod'

// Core keyboard event types
export interface KeyEvent {
  key: string
  type: 'press' | 'release' | 'hold'
  timestamp: number
  duration?: number
}

export interface KeyboardFrame {
  id: number | string
  timestamp: number
  justPressed: Set<string>
  heldKeys: Set<string>
  justReleased: Set<string>
  holdDurations: Map<string, number>
}

export interface KeyboardState {
  key: string
  state: 'idle' | 'justPressed' | 'held' | 'released'
  initialPressTime: number
  holdDuration: number
  lastUpdateTime: number
}

// Zod validation schemas
export const KeyEventSchema = z.object({
  key: z.string(),
  type: z.enum(['press', 'release', 'hold']),
  timestamp: z.number(),
  duration: z.number().optional()
})
