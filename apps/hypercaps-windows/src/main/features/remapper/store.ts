import { z } from 'zod'
import { createStore } from '../../service/store'

/**
 * Schema for key remapping configuration
 */
const RemapperConfigSchema = z.object({
  isEnabled: z.boolean(),
  remaps: z.record(z.string(), z.array(z.string()))
})

/**
 * Remapper configuration type
 */
type RemapperConfig = z.infer<typeof RemapperConfigSchema>

/**
 * Remapper events
 */
interface RemapperEvents {
  'store:changed': { config: RemapperConfig }
  'store:error': { error: Error }
  'store:reset': undefined
  'remap:added': { key: string; remappedTo: string[] }
  'remap:removed': { key: string }
  'remap:updated': { key: string; remappedTo: string[] }
}

/**
 * Create remapper store instance
 */
export const remapperStore = createStore<RemapperConfig, RemapperEvents>({
  name: 'remapper',
  schema: RemapperConfigSchema,
  defaultConfig: {
    isEnabled: true,
    remaps: {
      Capital: ['LShift']
    }
  }
})

/**
 * Remapper store utilities
 */
export const remapper = {
  /**
   * Enable or disable remapper
   * @example
   * ```ts
   * // Enable remapper
   * remapper.setEnabled(true)
   *
   * // Disable remapper
   * remapper.setEnabled(false)
   * ```
   */
  setEnabled(enabled: boolean) {
    remapperStore.update({
      update: (config) => {
        config.isEnabled = enabled
      }
    })
  },

  /**
   * Get all remaps
   * @example
   * ```ts
   * // Get all remaps and their configuration
   * const { remaps, isEnabled } = remapper.getAllRemaps()
   * ```
   */
  getAllRemaps() {
    return remapperStore.get()
  },

  /**
   * Add a new remap
   * @example
   * ```ts
   * // Remap CapsLock to Left Shift
   * remapper.addRemap('Capital', ['LShift'])
   * ```
   */
  addRemap(key: string, remappedTo: string[]) {
    remapperStore.update({
      update: (config) => {
        config.remaps[key] = remappedTo
      }
    })
  },

  /**
   * Remove a remap
   * @example
   * ```ts
   * // Remove CapsLock remap
   * remapper.removeRemap('Capital')
   * ```
   */
  removeRemap(key: string) {
    remapperStore.update({
      update: (config) => {
        delete config.remaps[key]
      }
    })
  },

  /**
   * Update an existing remap
   * @example
   * ```ts
   * // Update CapsLock remap to map to both shifts
   * remapper.updateRemap('Capital', ['LShift', 'RShift'])
   * ```
   */
  updateRemap(key: string, remappedTo: string[]) {
    remapperStore.update({
      update: (config) => {
        if (key in config.remaps) {
          config.remaps[key] = remappedTo
        }
      }
    })
  },

  /**
   * Update multiple remaps
   * @example
   * ```ts
   * // Replace all remaps with a new set
   * remapper.updateRemaps({
   *   'Capital': ['LShift'],
   *   'Tab': ['LControl']
   * })
   * ```
   */
  updateRemaps(remaps: Record<string, string[]>) {
    remapperStore.update({
      update: (config) => {
        config.remaps = remaps
      }
    })
  }
}

// Export config type for use in other files
export type { RemapperConfig }
