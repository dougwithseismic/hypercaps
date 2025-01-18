import { KeyboardConfig } from '@hypercaps/keyboard-monitor'
import { KeyboardConfig as StoreConfig } from '../store'

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
