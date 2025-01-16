import { z } from 'zod'
import { createStore } from '../store'
import { CapsLockBehavior } from '@hypercaps/keyboard-monitor'

/**
 * Keyboard service configuration schema
 */
const keyboardConfigSchema = z.object({
  service: z.object({
    enabled: z.boolean(),
    bufferWindow: z.number(),
    frameHistory: z.object({
      maxSize: z.number(),
      retentionMs: z.number()
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
      bufferWindow: 3000, // 3 seconds
      frameHistory: {
        maxSize: 100,
        retentionMs: 5000 // 5 seconds
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
  },

  /**
   * Update buffer window
   */
  setBufferWindow(bufferWindow: number) {
    keyboardStore.update({
      update: (config) => {
        config.service.bufferWindow = bufferWindow
      }
    })
  }
}

// Export config type for use in other files
export type { KeyboardConfig }
