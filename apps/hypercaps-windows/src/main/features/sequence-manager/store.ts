import { z } from 'zod'
import { createStore } from '../../service/store'
import type { InputSequence, StateStep, SequenceStep } from './types'

const sequenceManagerConfigSchema = z.object({
  isEnabled: z.boolean(),
  bufferSize: z.number().min(30).max(300),
  maxActiveSequences: z.number().min(1).max(10),
  debugMode: z.boolean(),
  sequences: z.record(z.string(), z.custom<InputSequence>()),
  frameRate: z.number().min(30).max(240),
  cooldownMs: z.number().min(0).max(2000)
})

type SequenceManagerConfig = z.infer<typeof sequenceManagerConfigSchema>

interface SequenceManagerStoreEvents {
  'store:changed': { config: SequenceManagerConfig }
  'store:error': { error: Error }
  'store:reset': undefined
}

export const sequenceStore = createStore<SequenceManagerConfig, SequenceManagerStoreEvents>({
  name: 'sequence-manager',
  schema: sequenceManagerConfigSchema,
  defaultConfig: {
    isEnabled: true,
    bufferSize: 60,
    maxActiveSequences: 3,
    debugMode: true,
    cooldownMs: 100,
    sequences: {
      'boost-1': {
        id: 'boost-1',
        type: 'STATE',
        held: [32], // Space
        toleranceMs: 100,
        duration: {
          minMs: 0,
          maxMs: 3000,
          triggerMs: 500 // Trigger boost 1 at 0.5s
        }
      },
      'boost-2': {
        id: 'boost-2',
        type: 'STATE',
        held: [32], // Space
        toleranceMs: 100,
        duration: {
          minMs: 0,
          maxMs: 3000,
          triggerMs: 1000 // Trigger boost 2 at 1.0s
        }
      },
      'boost-3': {
        id: 'boost-3',
        type: 'STATE',
        held: [32], // Space
        toleranceMs: 100,
        duration: {
          minMs: 0,
          maxMs: 3000,
          triggerMs: 2000 // Trigger boost 3 at 2.0s
        }
      },
      'ctrl-space-hold': {
        id: 'ctrl-space-hold',
        type: 'SEQUENCE',
        timeoutMs: 2000,
        steps: [
          {
            type: 'STATE',
            held: [17, 32], // Ctrl + Space
            toleranceMs: 100,
            duration: {
              minMs: 0, // No minimum required
              maxMs: 2000, // But don't wait forever
              triggerMs: 1500 // Trigger exactly at 1.5 seconds
            }
          }
        ]
      },
      'shift-alt-p': {
        id: 'shift-alt-p',
        type: 'SEQUENCE',
        timeoutMs: 2000,
        steps: [
          {
            type: 'STATE',
            held: [16, 18], // Shift + Alt
            toleranceMs: 100,
            duration: {
              minMs: 50, // Brief hold to establish the modifier keys
              maxMs: 2000 // Can hold for a while
            }
          },
          {
            type: 'STATE',
            held: [16, 18, 80], // Shift + Alt still held, plus P
            toleranceMs: 100,
            duration: {
              minMs: 50,
              maxMs: 300
            }
          }
        ]
      },
      hadouken: {
        id: 'hadouken',
        type: 'SEQUENCE',
        timeoutMs: 1000, // 1 second to complete the hadouken motion
        steps: [
          {
            type: 'STATE',
            held: [40], // Down
            toleranceMs: 100,
            duration: {
              minMs: 50,
              maxMs: 300
            }
          },
          {
            type: 'STATE',
            released: [40], // Verify Down is released
            toleranceMs: 100,
            duration: {
              minMs: 0,
              maxMs: 100
            }
          },
          {
            type: 'STATE',
            held: [40, 39], // Down + Right
            toleranceMs: 100,
            duration: {
              minMs: 50,
              maxMs: 300
            }
          },
          {
            type: 'STATE',
            released: [40], // Verify Down is released
            toleranceMs: 100,
            duration: {
              minMs: 0,
              maxMs: 100
            }
          },
          {
            type: 'STATE',
            held: [39], // Just Right
            toleranceMs: 100,
            duration: {
              minMs: 50,
              maxMs: 300
            }
          },
          {
            type: 'STATE',
            released: [39], // Verify Right is released
            toleranceMs: 100,
            duration: {
              minMs: 0,
              maxMs: 100
            }
          },
          {
            type: 'STATE',
            held: [80], // P key for punch
            toleranceMs: 100,
            duration: {
              minMs: 50,
              maxMs: 300
            }
          },
          {
            type: 'STATE',
            released: [80], // Verify P is released
            toleranceMs: 100,
            duration: {
              minMs: 0,
              maxMs: 100
            }
          }
        ]
      }
    },
    frameRate: 60
  }
})

export const sequenceManager = {
  setEnabled(enabled: boolean) {
    sequenceStore.update({
      update: (config) => {
        config.isEnabled = enabled
      }
    })
  },

  setFrameRate(rate: number) {
    sequenceStore.update({
      update: (config) => {
        config.frameRate = rate
      }
    })
  }
}

export type { SequenceManagerConfig, InputSequence, StateStep, SequenceStep }
