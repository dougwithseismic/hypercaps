import { AppState } from './types/app-state';

/**
 * Default application state configuration
 * This is used when initializing the app for the first time
 * or when falling back due to state validation errors
 */
export const DEFAULT_STATE: AppState = {
  settings: {
    startupOnBoot: false,
    startMinimized: false,
  },
  features: [
    {
      name: 'hyperKey',
      isFeatureEnabled: true,
      enableFeatureOnStartup: true,
      config: {
        isHyperKeyEnabled: false,
        trigger: 'Capital',
        modifiers: [],
        capsLockBehavior: 'BlockToggle',
      },
    },
    {
      name: 'shortcutManager',
      isFeatureEnabled: true,
      enableFeatureOnStartup: true,
      config: {
        shortcuts: [],
        isEnabled: true,
      },
    },
  ],
};
