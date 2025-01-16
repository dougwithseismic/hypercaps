import { RemapperConfig } from '../../features/remapper/types'
import { ShortcutManagerConfig } from '../../features/shortcuts/types'

export interface AppConfig {
  version: string
  firstRun: boolean
  theme: 'light' | 'dark' | 'system'
  startMinimized: boolean
  startWithSystem: boolean
}

export interface WindowBounds {
  x: number | undefined
  y: number | undefined
  width: number
  height: number
}

export interface WindowConfig {
  bounds: WindowBounds
  isMaximized: boolean
}

export interface FeatureState {
  name: string
  isFeatureEnabled: boolean
  enableFeatureOnStartup: boolean
}

export interface Features {
  remapper: FeatureState & {
    config: RemapperConfig
  }
  shortcuts: FeatureState & {
    config: ShortcutManagerConfig
  }
}

export interface StoreSchema {
  app: AppConfig
  window: WindowConfig
  features: Features
}

export const DEFAULT_CONFIG: StoreSchema = {
  app: {
    version: '0.0.1',
    firstRun: true,
    theme: 'system',
    startMinimized: false,
    startWithSystem: false
  },
  window: {
    bounds: {
      x: undefined,
      y: undefined,
      width: 800,
      height: 600
    },
    isMaximized: false
  },
  features: {
    shortcuts: {},
    remapper: {
      name: 'remapper',
      isFeatureEnabled: true,
      enableFeatureOnStartup: true,
      config: {
        isRemapperEnabled: true,
        capsLockBehavior: 'BlockToggle',
        remaps: {
          Capital: ['CapsLock', 'LShift', 'LAlt']
        }
      }
    }
  }
}
