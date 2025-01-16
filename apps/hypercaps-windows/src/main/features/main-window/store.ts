import { z } from 'zod'
import { createStore } from '../../service/store'

/**
 * Window configuration schema
 */
const windowConfigSchema = z.object({
  bounds: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number(),
    height: z.number()
  }),
  state: z.object({
    isMaximized: z.boolean(),
    isMinimized: z.boolean(),
    isVisible: z.boolean(),
    isFocused: z.boolean(),
    isAlwaysOnTop: z.boolean()
  }),
  behavior: z.object({
    rememberPosition: z.boolean(),
    rememberSize: z.boolean(),
    startMinimized: z.boolean(),
    hideMenuBar: z.boolean(),
    showOnAllWorkspaces: z.boolean()
  }),
  appearance: z.object({
    backgroundColor: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    vibrancy: z
      .enum([
        'none',
        'titlebar',
        'selection',
        'menu',
        'popover',
        'sidebar',
        'header',
        'sheet',
        'window',
        'hud',
        'fullscreen-ui',
        'tooltip',
        'content',
        'under-window',
        'under-page'
      ])
      .optional()
  })
})

/**
 * Window configuration type
 */
type WindowConfig = z.infer<typeof windowConfigSchema>

/**
 * Window-specific events
 */
interface WindowEvents {
  'store:changed': { config: WindowConfig }
  'store:error': { error: Error }
  'store:reset': undefined
  'window:bounds:changed': { bounds: WindowConfig['bounds'] }
  'window:state:changed': { state: WindowConfig['state'] }
  'window:behavior:changed': { behavior: WindowConfig['behavior'] }
  'window:appearance:changed': { appearance: WindowConfig['appearance'] }
  'window:focused': undefined
  'window:blurred': undefined
  'window:moved': { x: number; y: number }
  'window:resized': { width: number; height: number }
}

/**
 * Create window store instance
 */
export const windowStore = createStore<WindowConfig, WindowEvents>({
  name: 'window',
  schema: windowConfigSchema,
  defaultConfig: {
    bounds: {
      width: 900,
      height: 670
    },
    state: {
      isMaximized: false,
      isMinimized: false,
      isVisible: false,
      isFocused: false,
      isAlwaysOnTop: false
    },
    behavior: {
      rememberPosition: true,
      rememberSize: true,
      startMinimized: false,
      hideMenuBar: true,
      showOnAllWorkspaces: false
    },
    appearance: {
      vibrancy: 'none'
    }
  }
})

/**
 * Window store utilities
 */
export const window = {
  /**
   * Update window bounds
   */
  setBounds(bounds: Partial<WindowConfig['bounds']>) {
    windowStore.update({
      update: (config) => {
        Object.assign(config.bounds, bounds)
      }
    })
  },

  /**
   * Update window state
   */
  setState(state: Partial<WindowConfig['state']>) {
    windowStore.update({
      update: (config) => {
        Object.assign(config.state, state)
      }
    })
  },

  /**
   * Update window behavior settings
   */
  setBehavior(settings: Partial<WindowConfig['behavior']>) {
    windowStore.update({
      update: (config) => {
        Object.assign(config.behavior, settings)
      }
    })
  },

  /**
   * Update window appearance
   */
  setAppearance(appearance: Partial<WindowConfig['appearance']>) {
    windowStore.update({
      update: (config) => {
        Object.assign(config.appearance, appearance)
      }
    })
  },

  /**
   * Toggle window visibility
   */
  toggleVisibility() {
    windowStore.update({
      update: (config) => {
        config.state.isVisible = !config.state.isVisible
      }
    })
  },

  /**
   * Toggle window maximized state
   */
  toggleMaximized() {
    windowStore.update({
      update: (config) => {
        config.state.isMaximized = !config.state.isMaximized
      }
    })
  },

  /**
   * Toggle always on top
   */
  toggleAlwaysOnTop() {
    windowStore.update({
      update: (config) => {
        config.state.isAlwaysOnTop = !config.state.isAlwaysOnTop
      }
    })
  }
}

// Export config type for use in other files
export type { WindowConfig }
