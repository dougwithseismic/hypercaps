import { Features } from './schema'
import { StoreManager } from './index'
import { RemapperConfig } from '../../features/remapper/types'
import { ShortcutManagerConfig, Shortcut } from '../../features/shortcuts/types/shortcut-config'

/**
 * Creates a hook for a specific feature's configuration and state
 * @param feature The feature to create a hook for
 * @returns An object containing the feature's state and methods to update it
 */
export const createFeatureHook = <K extends keyof Features>(feature: K) => {
  const store = StoreManager.getInstance()

  return {
    /**
     * Gets the current feature configuration
     */
    getConfig: () => store.getFeatureConfig(feature),

    /**
     * Updates the feature configuration
     */
    setConfig: (config: Partial<Features[K]['config']>) => {
      store.setFeatureConfig(feature, config)
    },

    /**
     * Gets whether the feature is enabled
     */
    isEnabled: () => store.getFeatureConfig(feature).isFeatureEnabled,

    /**
     * Sets whether the feature is enabled
     */
    setEnabled: (enabled: boolean) => {
      store.setFeatureEnabled(feature, enabled)
    },

    /**
     * Subscribes to changes in the feature's configuration
     * @param callback Callback to be called when the feature's configuration changes
     * @returns Cleanup function to unsubscribe
     */
    onConfigChange: (callback: (config: Features[K]['config']) => void) => {
      return store.events.on('feature:config:changed', (payload) => {
        if (payload.feature === feature) {
          callback(payload.config as Features[K]['config'])
        }
      })
    },

    /**
     * Subscribes to changes in the feature's enabled state
     * @param callback Callback to be called when the feature's enabled state changes
     * @returns Cleanup function to unsubscribe
     */
    onEnabledChange: (callback: (enabled: boolean) => void) => {
      return store.events.on('feature:enabled:changed', (payload) => {
        if (payload.feature === feature) {
          callback(payload.enabled)
        }
      })
    }
  }
}

/**
 * Strongly-typed hooks for the remapper feature
 */
export const remapperHooks = {
  ...createFeatureHook('remapper'),

  /**
   * Updates specific remapper settings
   */
  updateSettings: (settings: Partial<RemapperConfig>) => {
    const store = StoreManager.getInstance()
    store.setFeatureConfig('remapper', settings)
  },

  /**
   * Updates remaps configuration
   */
  updateRemaps: (remaps: RemapperConfig['remaps']) => {
    const store = StoreManager.getInstance()
    store.setFeatureConfig('remapper', { remaps })
  }
}

/**
 * Strongly-typed hooks for the shortcuts feature
 */
export const shortcutHooks = {
  ...createFeatureHook('shortcuts'),

  /**
   * Adds a new shortcut
   */
  addShortcut: (shortcut: Omit<Shortcut, 'id'>) => {
    const store = StoreManager.getInstance()
    const config = store.getFeatureConfig('shortcuts').config
    const id = crypto.randomUUID()

    store.setFeatureConfig('shortcuts', {
      shortcuts: [...config.shortcuts, { ...shortcut, id }]
    })

    return id
  },

  /**
   * Updates an existing shortcut
   */
  updateShortcut: (id: string, shortcut: Partial<Omit<Shortcut, 'id'>>) => {
    const store = StoreManager.getInstance()
    const config = store.getFeatureConfig('shortcuts').config

    store.setFeatureConfig('shortcuts', {
      shortcuts: config.shortcuts.map((s) => (s.id === id ? { ...s, ...shortcut } : s))
    })
  },

  /**
   * Removes a shortcut
   */
  removeShortcut: (id: string) => {
    const store = StoreManager.getInstance()
    const config = store.getFeatureConfig('shortcuts').config

    store.setFeatureConfig('shortcuts', {
      shortcuts: config.shortcuts.filter((s) => s.id !== id)
    })
  },

  /**
   * Enables or disables a specific shortcut
   */
  toggleShortcut: (id: string, enabled: boolean) => {
    const store = StoreManager.getInstance()
    const config = store.getFeatureConfig('shortcuts').config

    store.setFeatureConfig('shortcuts', {
      shortcuts: config.shortcuts.map((s) => (s.id === id ? { ...s, enabled } : s))
    })
  }
}

/**
 * Pre-configured hooks for each feature
 */
export const featureHooks = {
  remapper: remapperHooks,
  shortcuts: shortcutHooks
} as const
