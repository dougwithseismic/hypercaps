import { Features } from './schema'
import { StoreManager } from './index'

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
