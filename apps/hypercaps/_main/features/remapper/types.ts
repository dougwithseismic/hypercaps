import { CapsLockBehavior } from '@hypercaps/keyboard-monitor';

export interface RemapperFeature {
  isFeatureEnabled: boolean;
  config: RemapperConfig;
}

export interface RemapperConfig {
  isRemapperEnabled: boolean;
  capsLockBehavior: CapsLockBehavior;
  remaps: RemapperRemap;
}

export interface RemapperRemap {
  [key: string]: string[];
}
