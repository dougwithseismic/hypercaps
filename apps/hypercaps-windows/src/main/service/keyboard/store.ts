import { z } from 'zod'
import { createStore } from '../store'

/**
 * Keyboard service configuration schema
 */
const keyboardConfigSchema = z.object({
  service: z.object({
    enabled: z.boolean(),
    frameRate: z.number(),
    frameBufferSize: z.number(),
    frameHistory: z.object({
      maxSize: z.number(),
      retentionFrames: z.number()
    })
  }),
  monitoring: z.object({
    enabled: z.boolean(),
    capsLockBehavior: z.enum(['BlockToggle', 'None', 'DoublePress'] as const),
    debug: z.boolean()
  })
})

/**
 * Keyboard configuration type
 */
type KeyboardConfig = z.infer<typeof keyboardConfigSchema>

/**
 * Keyboard-specific events
 */
interface KeyboardEvents {
  'store:changed': { config: KeyboardConfig }
  'store:error': { error: Error }
  'store:reset': undefined
  'keyboard:enabled:changed': { enabled: boolean }
  'keyboard:monitoring:changed': { enabled: boolean }
  'keyboard:config:changed': { config: KeyboardConfig }
  'keyboard:error': { error: Error }
}

/**
 * Create keyboard store instance
 */
export const keyboardStore = createStore<KeyboardConfig, KeyboardEvents>({
  name: 'keyboard',
  schema: keyboardConfigSchema,
  defaultConfig: {
    service: {
      enabled: true,
      frameRate: 30,
      frameBufferSize: 60,
      frameHistory: {
        maxSize: 100,
        retentionFrames: 300
      }
    },
    monitoring: {
      enabled: true,
      capsLockBehavior: 'BlockToggle',
      debug: false
    }
  }
})

/**
 * Keyboard store utilities
 */
export const keyboard = {
  /**
   * Enable or disable keyboard service
   */
  setEnabled(enabled: boolean) {
    keyboardStore.update({
      update: (config) => {
        config.service.enabled = enabled
      }
    })
  },

  /**
   * Enable or disable keyboard monitoring
   */
  setMonitoring(enabled: boolean) {
    keyboardStore.update({
      update: (config) => {
        config.monitoring.enabled = enabled
      }
    })
  },

  /**
   * Update frame rate
   */
  setFrameRate(frameRate: number) {
    keyboardStore.update({
      update: (config) => {
        config.service.frameRate = frameRate
      }
    })
  },

  /**
   * Update frame buffer size
   */
  setFrameBufferSize(size: number) {
    keyboardStore.update({
      update: (config) => {
        config.service.frameBufferSize = size
      }
    })
  },

  /**
   * Update frame history settings
   */
  setFrameHistory(settings: Partial<KeyboardConfig['service']['frameHistory']>) {
    keyboardStore.update({
      update: (config) => {
        Object.assign(config.service.frameHistory, settings)
      }
    })
  },

  /**
   * Update monitoring settings
   */
  setMonitoringConfig(settings: Partial<KeyboardConfig['monitoring']>) {
    keyboardStore.update({
      update: (config) => {
        Object.assign(config.monitoring, settings)
      }
    })
  }
}

// Export config type for use in other files
export type { KeyboardConfig }
