/**
 * Shared keyboard types
 * These types are used across both the native module and TypeScript code
 */
export type KeyEventType = 'keydown' | 'keyup' | 'keyhold';
export interface KeyEvent {
  type: KeyEventType;
  key: string;
}
export interface KeyboardState {
  justPressed: string[];
  held: string[];
  justReleased: string[];
  holdDurations: Record<string, number>;
}
export interface KeyboardFrame {
  frame: number;
  timestamp: number;
  event: KeyEvent;
  state: KeyboardState;
}

export type CapsLockBehavior = 'None' | 'DoublePress' | 'BlockToggle';
export interface KeyboardConfig {
  isEnabled: boolean;
  isRemapperEnabled: boolean;
  remaps: RemapperRemap;
  capsLockBehavior?: CapsLockBehavior;
  bufferWindow?: number;
}
