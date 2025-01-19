/**
 * Shared keyboard types
 * These types are used across both the native module and TypeScript code
 */
export type KeyEventType = 'keydown' | 'keyup';
export interface KeyEvent {
  type: KeyEventType;
  key: string;
}
export interface KeyState {
  justPressed: string[];
  held: string[];
  justReleased: string[];
  holdDurations: Record<string, number>;
  frameNumber: number;
}
export interface KeyboardFrame {
  id: string;
  frameNumber: number;
  timestamp: number;
  frameTimestamp: number;
  processed: boolean;
  validationErrors?: string[];
  event: KeyEvent;
  state: KeyState;
  gateOpen: boolean;
}
export type CapsLockBehavior = 'None' | 'DoublePress' | 'BlockToggle';
export interface RemapRule {
  from: string;
  to: string[];
}
export interface RemapValidationError {
  type: 'circular' | 'invalid_key' | 'self_reference' | 'chain_length';
  message: string;
  rule?: RemapRule;
}
/**
 * Configuration for the keyboard monitor
 */
export interface KeyboardConfig {
  isEnabled: boolean;
  isRemapperEnabled: boolean;
  remaps: Record<string, string[]>;
  maxRemapChainLength: number;
  capsLockBehavior: CapsLockBehavior;
  frameRate: number;
  frameBufferSize: number;
  bufferWindow?: number;
  gateTimeout: number;
}
