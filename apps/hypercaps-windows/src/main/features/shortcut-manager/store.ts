import { z } from 'zod'
import { createStore } from '../../service/store'
import { ShortcutSchema } from './types'
import { randomUUID } from 'crypto'

/**
 * Shortcut manager configuration schema
 */
const shortcutManagerConfigSchema = z.object({
  isEnabled: z.boolean(),
  shortcuts: z.array(ShortcutSchema)
})

/**
 * Shortcut manager configuration type
 */
type ShortcutManagerConfig = z.infer<typeof shortcutManagerConfigSchema>

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
  schema: shortcutManagerConfigSchema,
  defaultConfig: {
    isEnabled: true,
    shortcuts: [
      {
        id: '915b42fb-4890-4c40-9ad1-5b5bb21d7a2e',
        name: 'Open Notepad',
        enabled: true,
        cooldown: 500,
        trigger: {
          steps: [
            {
              type: 'combo',
              keys: ['LShift', 'LControl', 'N'],
              window: 200
            }
          ],
          totalTimeWindow: 500
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
   */
  setEnabled(enabled: boolean) {
    shortcutStore.update({
      update: (config) => {
        config.isEnabled = enabled
      }
    })
  },

  /**
   * Add a new shortcut
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
