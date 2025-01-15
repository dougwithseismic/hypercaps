/**
 * Keyboard State Types
 * Defines the types for keyboard state management
 */

import type {
  KeyEvent,
  KeyState,
  KeyboardFrame,
} from '@hypercaps/keyboard-monitor';

export type { KeyEvent, KeyState };

export interface KeyboardState extends Omit<KeyboardFrame, 'state'> {
  state: {
    justPressed: string[];
    held: string[];
    justReleased: string[];
    holdDurations: Record<string, number>;
  };
}

export interface ServiceState {
  isListening: boolean;
  isLoading: boolean;
  isStarting: boolean;
  isHyperKeyEnabled: boolean;
  error?: string;
  lastError?: {
    message: string;
    timestamp: number;
  };
}
