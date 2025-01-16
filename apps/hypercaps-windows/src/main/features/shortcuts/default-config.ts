import { FeatureState } from '../../infrastructure/store/schema'
import { ShortcutManagerConfig } from './types'

const DEFAULT_SHORTCUT_CONFIG: FeatureState & { config: ShortcutManagerConfig } = {
  name: 'shortcuts',
  isFeatureEnabled: true,
  enableFeatureOnStartup: true,
  config: {
    isEnabled: true,
    shortcuts: [
      {
        id: 'double-hg-hg',
        name: 'Double HG + HG',
        trigger: {
          steps: [
            {
              type: 'combo',
              keys: ['H', 'G'],
              holdTime: 1000
            },
            {
              type: 'combo',
              keys: ['H', 'G'],
              holdTime: 1000
            }
          ]
        },
        action: {
          type: 'launch',
          program: 'hypercaps.exe'
        },
        enabled: true
      }
    ]
  }
}

export { DEFAULT_SHORTCUT_CONFIG }
