import { z } from 'zod'
import { createStore } from '../../service/store'
import type { InputSequence, ChordStep, SequenceStep, HoldStep } from './types'

/**
 * Schema for sequence manager configuration
 */
const sequenceManagerConfigSchema = z.object({
  isEnabled: z.boolean(),
  bufferSize: z.number().min(30).max(300),
  maxActiveSequences: z.number().min(1).max(10),
  chordTolerance: z.number().min(1).max(5),
  debugMode: z.boolean(),
  sequences: z.record(z.string(), z.custom<InputSequence>()),
  frameRate: z.number().min(30).max(240),
  cooldownMs: z.number().min(0).max(2000) // Cooldown in milliseconds, max 2 seconds
})

/**
 * Sequence manager configuration type
 */
type SequenceManagerConfig = z.infer<typeof sequenceManagerConfigSchema>

/**
 * Sequence manager store events
 */
interface SequenceManagerStoreEvents {
  'store:changed': { config: SequenceManagerConfig }
  'store:error': { error: Error }
  'store:reset': undefined
}

/**
 * Create sequence manager store instance
 */
export const sequenceStore = createStore<SequenceManagerConfig, SequenceManagerStoreEvents>({
  name: 'sequence-manager',
  schema: sequenceManagerConfigSchema,
  defaultConfig: {
    isEnabled: true,
    bufferSize: 60,
    maxActiveSequences: 3,
    chordTolerance: 2,
    debugMode: true,
    cooldownMs: 100, // Default 500ms cooldown
    sequences: {
      // Street Fighter Dragon Punch: Forward, Down, Down-Forward + Punch
      'dragon-punch': {
        id: 'dragon-punch',
        steps: [
          {
            type: 'SEQUENCE',
            keys: [39], // Forward
            maxGapMs: 200,
            allowExtraInputs: false
          },
          {
            type: 'SEQUENCE',
            keys: [40], // Down
            maxGapMs: 200,
            allowExtraInputs: false
          },
          {
            type: 'CHORD',
            keys: [40, 39], // Down + Forward
            toleranceMs: 50
          },
          {
            type: 'SEQUENCE',
            keys: [80], // P
            maxGapMs: 200,
            allowExtraInputs: false
          }
        ],
        timeoutMs: 1000,
        strictOrder: true
      },

      // Street Fighter Hadouken: Down, Down-Right, Right + Punch
      hadouken: {
        id: 'hadouken',
        steps: [
          {
            type: 'SEQUENCE',
            keys: [40], // Down
            maxGapMs: 200, // 200ms between inputs
            allowExtraInputs: false
          },
          {
            type: 'CHORD',
            keys: [40, 39], // Down + Right
            toleranceMs: 50 // 50ms tolerance for "simultaneous" press
          },
          {
            type: 'SEQUENCE',
            keys: [39], // Right
            maxGapMs: 200,
            allowExtraInputs: false
          },
          {
            type: 'SEQUENCE',
            keys: [80], // P
            maxGapMs: 200,
            allowExtraInputs: false
          }
        ],
        timeoutMs: 1000, // Complete within 1 second
        strictOrder: true
      },

      // Quick launcher: Ctrl+Space, hold for 500ms
      'quick-launcher': {
        id: 'quick-launcher',
        steps: [
          {
            type: 'CHORD',
            keys: [17, 32], // Ctrl + Space
            toleranceMs: 50
          },
          {
            type: 'HOLD',
            holdKeys: [17, 32], // Hold both Ctrl + Space
            pressKeys: [], // No additional keys needed
            minHoldMs: 500 // Hold for 500ms
          }
        ],
        timeoutMs: 1000,
        strictOrder: true
      },

      // Konami Code: Up, Up, Down, Down, Left, Right, Left, Right, B, A
      'konami-code': {
        id: 'konami-code',
        steps: [
          {
            type: 'SEQUENCE',
            keys: [38, 38, 40, 40, 37, 39, 37, 39], // Up, Up, Down, Down, Left, Right, Left, Right
            maxGapMs: 500,
            allowExtraInputs: false
          },
          {
            type: 'SEQUENCE',
            keys: [66, 65], // B, A
            maxGapMs: 500,
            allowExtraInputs: false
          }
        ],
        timeoutMs: 5000, // 5 seconds total
        strictOrder: true
      },

      // Power mode: Hold Shift + Alt, then press P while holding
      'power-mode': {
        id: 'power-mode',
        steps: [
          {
            type: 'HOLD',
            holdKeys: [16, 18], // Shift + Alt
            pressKeys: [80], // P
            minHoldMs: 250
          }
        ],
        timeoutMs: 1000,
        strictOrder: true
      },

      // Multi-chord: Ctrl+K, then Ctrl+B
      'toggle-sidebar': {
        id: 'toggle-sidebar',
        steps: [
          {
            type: 'CHORD',
            keys: [17, 75], // Ctrl + K
            toleranceMs: 50
          },
          {
            type: 'CHORD',
            keys: [17, 66], // Ctrl + B
            toleranceMs: 50
          }
        ],
        timeoutMs: 500,
        strictOrder: true
      },

      // Complex combo: Hold G, press H twice while holding G
      'g-h-combo': {
        id: 'g-h-combo',
        steps: [
          {
            type: 'HOLD',
            holdKeys: [71], // Hold G
            pressKeys: [72], // Press H first time
            minHoldMs: 100
          },
          {
            type: 'HOLD',
            holdKeys: [71], // Keep holding G
            pressKeys: [72], // Press H second time
            minHoldMs: 100
          }
        ],
        timeoutMs: 1000,
        strictOrder: true
      },

      // Mixed sequence: Ctrl+K, hold Ctrl, press 1,2,3 in sequence
      'number-sequence': {
        id: 'number-sequence',
        steps: [
          {
            type: 'CHORD',
            keys: [17, 75], // Ctrl + K
            toleranceMs: 50
          },
          {
            type: 'HOLD',
            holdKeys: [17], // Hold Ctrl
            pressKeys: [49, 50, 51], // 1,2,3
            minHoldMs: 200
          }
        ],
        timeoutMs: 1000,
        strictOrder: true
      }
    },
    frameRate: 60
  }
})

/**
 * Sequence manager store utilities
 */
export const sequenceManager = {
  /**
   * Enable or disable sequence manager
   */
  setEnabled(enabled: boolean) {
    sequenceStore.update({
      update: (config) => {
        config.isEnabled = enabled
      }
    })
  },

  /**
   * Update buffer size
   */
  setBufferSize(size: number) {
    sequenceStore.update({
      update: (config) => {
        config.bufferSize = size
      }
    })
  },

  /**
   * Update max active sequences
   */
  setMaxActiveSequences(max: number) {
    sequenceStore.update({
      update: (config) => {
        config.maxActiveSequences = max
      }
    })
  },

  /**
   * Update chord tolerance
   */
  setChordTolerance(frames: number) {
    sequenceStore.update({
      update: (config) => {
        config.chordTolerance = frames
      }
    })
  },

  /**
   * Toggle debug mode
   */
  setDebugMode(enabled: boolean) {
    sequenceStore.update({
      update: (config) => {
        config.debugMode = enabled
      }
    })
  },

  /**
   * Add a new sequence
   */
  addSequence(id: string, sequence: InputSequence) {
    sequenceStore.update({
      update: (config) => {
        config.sequences[id] = sequence
      }
    })
  },

  /**
   * Remove a sequence
   */
  removeSequence(id: string) {
    sequenceStore.update({
      update: (config) => {
        delete config.sequences[id]
      }
    })
  },

  /**
   * Update an existing sequence
   */
  updateSequence(id: string, sequence: InputSequence) {
    sequenceStore.update({
      update: (config) => {
        if (id in config.sequences) {
          config.sequences[id] = sequence
        }
      }
    })
  },

  /**
   * Get all sequences
   */
  getSequences() {
    return sequenceStore.get().sequences
  },

  /**
   * Update frame rate
   */
  setFrameRate(rate: number) {
    sequenceStore.update({
      update: (config) => {
        config.frameRate = rate
      }
    })
  },

  /**
   * Update cooldown duration
   */
  setCooldown(ms: number) {
    sequenceStore.update({
      update: (config) => {
        config.cooldownMs = ms
      }
    })
  }
}

// Export types
export type { SequenceManagerConfig, InputSequence, ChordStep, SequenceStep, HoldStep }
