/**
 * Shared keyboard types
 * These types are used across both the native module and TypeScript code
 */
export type KeyEventType = 'keydown' | 'keyup' | 'keyhold';
export interface KeyEvent {
    type: KeyEventType;
    key: string;
}
export interface KeyState {
    justPressed: number[];
    held: number[];
    justReleased: number[];
    holdDurations: Record<string, number>;
}
export interface KeyboardFrame {
    frame: number;
    timestamp: number;
    event: KeyEvent;
    state: KeyState;
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
    bufferWindow: number;
}
