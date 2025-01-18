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
  frameRate: z.number().min(30).max(240)
})

/**
 * Sequence manager configuration type
 */
type SequenceManagerConfig = z.infer<typeof sequenceManagerConfigSchema>

/**
 * Sequence manager events
 */
interface SequenceManagerEvents {
  'store:changed': { config: SequenceManagerConfig }
  'store:error': { error: Error }
  'store:reset': undefined
  'sequence:detected': {
    id: string
    sequence: InputSequence
    durationFrames: number
    startFrame: number
    endFrame: number
    timestamp: number
  }
  'sequence:failed': {
    id: string
    reason: 'timeout' | 'invalid_input' | 'wrong_order'
    failedAtStep: number
  }
  'sequence:progress': {
    id: string
    currentStep: number
    totalSteps: number
    elapsedFrames: number
  }
}

/**
 * Create sequence manager store instance
 */
export const sequenceStore = createStore<SequenceManagerConfig, SequenceManagerEvents>({
  name: 'sequence-manager',
  schema: sequenceManagerConfigSchema,
  defaultConfig: {
    isEnabled: true,
    bufferSize: 60,
    maxActiveSequences: 3,
    chordTolerance: 2,
    debugMode: false,
    sequences: {},
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
  }
}

// Export types
export type { SequenceManagerConfig, InputSequence, ChordStep, SequenceStep, HoldStep }
