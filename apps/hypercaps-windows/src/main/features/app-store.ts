import { z } from 'zod'
import { createStore } from '../service/store'

/**
 * App configuration schema
 */
const appConfigSchema = z.object({
  version: z.string(),
  startup: z.object({
    launchOnBoot: z.boolean(),
    startMinimized: z.boolean(),
    reopenLastWindow: z.boolean()
  }),
  theme: z.enum(['light', 'dark', 'system']),
  updates: z.object({
    checkAutomatically: z.boolean(),
    lastChecked: z.number().optional(),
    channel: z.enum(['stable', 'beta']),
    autoDownload: z.boolean()
  }),
  system: z.object({
    hardwareAcceleration: z.boolean(),
    allowCrashReports: z.boolean(),
    allowAnalytics: z.boolean()
  }),
  shortcuts: z.object({
    globalShortcutsEnabled: z.boolean(),
    showShortcutHints: z.boolean()
  }),
  developer: z
    .object({
      devTools: z.boolean(),
      debugLogging: z.boolean()
    })
    .optional()
})

/**
 * App configuration type
 */
type AppConfig = z.infer<typeof appConfigSchema>

/**
 * App-specific events
 */
interface AppEvents {
  'store:changed': { config: AppConfig }
  'store:error': { error: Error }
  'store:reset': undefined
  'app:theme:changed': { theme: AppConfig['theme'] }
  'app:startup:changed': { startup: AppConfig['startup'] }
  'app:update:available': { version: string }
  'app:shortcuts:changed': { shortcuts: AppConfig['shortcuts'] }
  'app:system:changed': { system: AppConfig['system'] }
}

/**
 * Create app store instance
 */
export const appStore = createStore<AppConfig, AppEvents>({
  name: 'app',
  schema: appConfigSchema,
  defaultConfig: {
    version: '1.0.0',
    startup: {
      launchOnBoot: false,
      startMinimized: false,
      reopenLastWindow: true
    },
    theme: 'system',
    updates: {
      checkAutomatically: true,
      channel: 'stable',
      autoDownload: true
    },
    system: {
      hardwareAcceleration: true,
      allowCrashReports: true,
      allowAnalytics: false
    },
    shortcuts: {
      globalShortcutsEnabled: true,
      showShortcutHints: true
    }
  }
})

/**
 * App store utilities
 */
export const app = {
  /**
   * Update theme
   */
  setTheme(theme: AppConfig['theme']) {
    appStore.set({
      config: { theme }
    })
  },

  /**
   * Update startup settings
   */
  setStartup(settings: Partial<AppConfig['startup']>) {
    appStore.update({
      update: (config) => {
        Object.assign(config.startup, settings)
      }
    })
  },

  /**
   * Update system settings
   */
  setSystem(settings: Partial<AppConfig['system']>) {
    appStore.update({
      update: (config) => {
        Object.assign(config.system, settings)
      }
    })
  },

  /**
   * Update shortcut settings
   */
  setShortcuts(settings: Partial<AppConfig['shortcuts']>) {
    appStore.update({
      update: (config) => {
        Object.assign(config.shortcuts, settings)
      }
    })
  },

  /**
   * Check for updates
   */
  checkForUpdates() {
    appStore.update({
      update: (config) => {
        config.updates.lastChecked = Date.now()
      }
    })
    // TODO: Implement actual update check
  }
}

// Export config type for use in other files
export type { AppConfig }
