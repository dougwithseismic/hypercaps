import { createFeatureHook } from '../../infrastructure/store/create-feature-hook'
import { StoreManager } from '../../infrastructure/store'
import { Shortcut } from './types/shortcut-config'

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
