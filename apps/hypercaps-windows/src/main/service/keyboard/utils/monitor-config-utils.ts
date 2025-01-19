import { KeyboardConfig } from '@hypercaps/keyboard-monitor'
import { KeyboardConfig as StoreConfig } from '../store'

// TODO: CAREFUL! I dont think we should be using this.

export const createMonitorConfig = (storeConfig: StoreConfig): KeyboardConfig => {
  return {
    isRemapperEnabled: true,
    remaps: { Capital: ['LShift'] },
    maxRemapChainLength: 1,
    isEnabled: storeConfig.monitoring.enabled,
    capsLockBehavior: storeConfig.monitoring.capsLockBehavior,
    frameRate: storeConfig.service.frameRate,
    frameBufferSize: storeConfig.service.frameBufferSize
  }
}
