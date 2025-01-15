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
export interface KeyboardConfig {
    isEnabled: boolean;
    isHyperKeyEnabled: boolean;
    trigger: string;
    modifiers: string[];
    capsLockBehavior?: 'None' | 'DoublePress' | 'BlockToggle';
    bufferWindow?: number;
}
