import { z } from 'zod'
import { createStore } from '../../service/store'
import { ShortcutManagerConfigSchema, ShortcutSchema } from './types'
import { randomUUID } from 'crypto'

/**
 * Shortcut manager configuration type
 */
type ShortcutManagerConfig = z.infer<typeof ShortcutManagerConfigSchema>

/**
 * Shortcut manager events
 */
interface ShortcutManagerEvents {
  'store:changed': { config: ShortcutManagerConfig }
  'store:error': { error: Error }
  'store:reset': undefined
  'shortcut:added': { shortcut: z.infer<typeof ShortcutSchema> }
  'shortcut:removed': { id: string }
  'shortcut:updated': { shortcut: z.infer<typeof ShortcutSchema> }
  'shortcut:enabled:changed': { id: string; enabled: boolean }
}

/**
 * Create shortcut manager store instance
 */
export const shortcutStore = createStore<ShortcutManagerConfig, ShortcutManagerEvents>({
  name: 'shortcut-manager',
  schema: ShortcutManagerConfigSchema,
  defaultConfig: {
    isEnabled: true,
    shortcuts: [
      {
        id: '915b42fb-4890-4c40-9ad1-5b5bb21d7a2e',
        name: 'Open Calculator',
        enabled: true,
        cooldown: 500,
        trigger: {
          steps: [
            {
              type: 'combo',
              keys: ['LShift', 'LControl', 'N'],
              conditions: {
                strict: false,
                window: 800
              }
            }
          ],
          totalTimeWindow: 1000,
          strict: false
        },
        action: {
          type: 'launch',
          program: 'calc.exe'
        }
      },
      {
        id: '2f3a9d8c-6b7e-4f5d-9c1a-0e2b4d5f6g7h',
        name: 'Triple -  HG+HG+HG',
        enabled: true,
        cooldown: 500,
        trigger: {
          steps: [
            {
              type: 'combo',
              keys: ['H', 'G'],
              conditions: {
                strict: true,
                window: 200
              }
            },
            {
              type: 'combo',
              keys: ['H', 'G'],
              conditions: {
                strict: true,
                window: 200
              }
            },
            {
              type: 'combo',
              keys: ['H', 'G'],
              conditions: {
                strict: true,
                window: 200
              }
            }
          ],
          totalTimeWindow: 500,
          strict: false
        },
        action: {
          type: 'launch',
          program: 'explorer.exe'
        }
      },
      {
        id: '3f4b9e8d-7c8f-5g6h-0i1j-2k3l4m5n6o7p',
        name: 'Hold Shift then Shift+A',
        enabled: true,
        cooldown: 500,
        trigger: {
          steps: [
            {
              type: 'hold',
              keys: ['LShift'],
              conditions: {
                strict: false,
                window: 200,
                holdTime: 1000
              }
            },
            {
              type: 'combo',
              keys: ['LShift', 'A'],
              conditions: {
                strict: false,
                window: 200
              }
            }
          ],
          totalTimeWindow: 2000,
          strict: false
        },
        action: {
          type: 'launch',
          program: 'notepad.exe'
        }
      }
    ]
  }
})

/**
 * Shortcut manager store utilities
 */
export const shortcuts = {
  /**
   * Enable or disable shortcut manager
   * @example
   * ```ts
   * // Enable shortcut manager
   * shortcuts.setEnabled(true)
   *
   * // Disable shortcut manager
   * shortcuts.setEnabled(false)
   * ```
   */
  setEnabled(enabled: boolean) {
    shortcutStore.update({
      update: (config) => {
        config.isEnabled = enabled
      }
    })
  },

  /**
   * Get all shortcuts
   * @example
   * ```ts
   * // Get all shortcuts and their configuration
   * const { shortcuts, isEnabled } = shortcuts.getAllShortcuts()
   * ```
   */
  getAllShortcuts() {
    return shortcutStore.get()
  },

  /**
   * Get a shortcut by id
   * @example
   * ```ts
   * // Get a specific shortcut
   * const shortcut = shortcuts.getShortcutById('915b42fb-4890-4c40-9ad1-5b5bb21d7a2e')
   * if (shortcut) {
   *   console.log(shortcut.name) // 'Open Calculator'
   * }
   * ```
   */
  getShortcutById(id: string) {
    return shortcutStore.get().shortcuts.find((s) => s.id === id)
  },
  /**
   * Add a new shortcut
   * @example
   * ```ts
   * // Add a new calculator shortcut
   * shortcuts.addShortcut({
   *   name: 'Open Calculator',
   *   enabled: true,
   *   cooldown: 500,
   *   trigger: {
   *     steps: [{
   *       type: 'combo',
   *       keys: ['LShift', 'LControl', 'N'],
   *       window: 200
   *     }],
   *     totalTimeWindow: 500
   *   },
   *   action: {
   *     type: 'launch',
   *     program: 'calc.exe'
   *   }
   * })
   * ```
   */
  addShortcut(shortcut: Omit<z.infer<typeof ShortcutSchema>, 'id'>) {
    shortcutStore.update({
      update: (config) => {
        const id = randomUUID()
        config.shortcuts.push({
          ...shortcut,
          id
        })
      }
    })
  },

  /**
   * Update an existing shortcut
   * @example
   * ```ts
   * // Update shortcut name and cooldown
   * shortcuts.updateShortcut('915b42fb-4890-4c40-9ad1-5b5bb21d7a2e', {
   *   name: 'Quick Calculator',
   *   cooldown: 300
   * })
   * ```
   */
  updateShortcut(id: string, updates: Partial<Omit<z.infer<typeof ShortcutSchema>, 'id'>>) {
    shortcutStore.update({
      update: (config) => {
        const index = config.shortcuts.findIndex((s) => s.id === id)
        if (index !== -1) {
          config.shortcuts[index] = {
            ...config.shortcuts[index],
            ...updates
          }
        }
      }
    })
  },

  /**
   * Remove a shortcut
   * @example
   * ```ts
   * // Remove a shortcut by id
   * shortcuts.removeShortcut('915b42fb-4890-4c40-9ad1-5b5bb21d7a2e')
   * ```
   */
  removeShortcut(id: string) {
    shortcutStore.update({
      update: (config) => {
        config.shortcuts = config.shortcuts.filter((s) => s.id !== id)
      }
    })
  },

  /**
   * Enable or disable a shortcut
   * @example
   * ```ts
   * // Disable a specific shortcut
   * shortcuts.setShortcutEnabled('915b42fb-4890-4c40-9ad1-5b5bb21d7a2e', false)
   *
   * // Enable a specific shortcut
   * shortcuts.setShortcutEnabled('915b42fb-4890-4c40-9ad1-5b5bb21d7a2e', true)
   * ```
   */
  setShortcutEnabled(id: string, enabled: boolean) {
    shortcutStore.update({
      update: (config) => {
        const shortcut = config.shortcuts.find((s) => s.id === id)
        if (shortcut) {
          shortcut.enabled = enabled
        }
      }
    })
  },

  /**
   * Update multiple shortcuts
   * @example
   * ```ts
   * // Replace all shortcuts with a new set
   * shortcuts.updateShortcuts([
   *   {
   *     id: 'new-id-1',
   *     name: 'Shortcut 1',
   *     enabled: true,
   *     cooldown: 500,
   *     trigger: {
   *       steps: [{
   *         type: 'combo',
   *         keys: ['A', 'B'],
   *         window: 200
   *       }],
   *       totalTimeWindow: 500
   *     },
   *     action: {
   *       type: 'launch',
   *       program: 'notepad.exe'
   *     }
   *   }
   * ])
   * ```
   */
  updateShortcuts(shortcuts: z.infer<typeof ShortcutSchema>[]) {
    shortcutStore.update({
      update: (config) => {
        config.shortcuts = shortcuts
      }
    })
  }
}

// Export config type for use in other files
export type { ShortcutManagerConfig }
