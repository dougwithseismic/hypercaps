import { remapperHooks } from './remapper/hooks'
import { shortcutHooks } from './shortcuts/hooks'

/**
 * Pre-configured hooks for each feature
 */
export const featureHooks = {
  remapper: remapperHooks,
  shortcuts: shortcutHooks
} as const

export { remapperHooks, shortcutHooks }
