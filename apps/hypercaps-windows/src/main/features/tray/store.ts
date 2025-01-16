import { z } from 'zod'
import { createStore } from '../../service/store'

/**
 * Tray configuration schema
 */
const trayConfigSchema = z.object({
  enabled: z.boolean(),
  minimizeToTray: z.boolean(),
  closeToTray: z.boolean(),
  showNotifications: z.boolean(),
  icon: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      custom: z.string().optional()
    })
    .optional()
})

/**
 * Tray configuration type
 */
type TrayConfig = z.infer<typeof trayConfigSchema>

/**
 * Tray-specific events
 */
interface TrayEvents {
  'store:changed': { config: TrayConfig }
  'store:error': { error: Error }
  'store:reset': undefined
  'tray:enabled:changed': { enabled: boolean }
  'tray:behavior:changed': { minimizeToTray: boolean; closeToTray: boolean }
  'tray:notifications:changed': { showNotifications: boolean }
  'tray:icon:changed': { icon: TrayConfig['icon'] }
}

/**
 * Create tray store instance
 */
export const trayStore = createStore<TrayConfig, TrayEvents>({
  name: 'tray',
  schema: trayConfigSchema,
  defaultConfig: {
    enabled: true,
    minimizeToTray: true,
    closeToTray: true,
    showNotifications: true,
    icon: {
      theme: 'system'
    }
  }
})

/**
 * Tray store utilities
 */
export const tray = {
  /**
   * Enable or disable tray
   */
  setEnabled(enabled: boolean) {
    trayStore.set({
      config: { enabled }
    })
  },

  /**
   * Update tray behavior settings
   */
  setBehavior(settings: Pick<TrayConfig, 'minimizeToTray' | 'closeToTray'>) {
    trayStore.update({
      update: (config) => {
        Object.assign(config, settings)
      }
    })
  },

  /**
   * Update notification settings
   */
  setNotifications(showNotifications: boolean) {
    trayStore.set({
      config: { showNotifications }
    })
  },

  /**
   * Update tray icon settings
   */
  setIcon(icon: TrayConfig['icon']) {
    trayStore.update({
      update: (config) => {
        config.icon = icon
      }
    })
  }
}

// Export config type for use in other files
export type { TrayConfig }
