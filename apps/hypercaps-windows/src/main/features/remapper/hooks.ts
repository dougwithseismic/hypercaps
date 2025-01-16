import { createFeatureHook } from '../../infrastructure/store/create-feature-hook'
import { StoreManager } from '../../infrastructure/store'
import { RemapperConfig } from './types'

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
