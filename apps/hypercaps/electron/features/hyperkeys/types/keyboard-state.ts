/**
 * Keyboard State Types
 * Defines the types for keyboard state management
 */

export interface KeyEvent {
  type: 'keydown' | 'keyup';
  key: string;
}

export interface KeyState {
  justPressed: string[];
  held: string[];
  justReleased: string[];
  holdDurations: Record<string, number>;
}

export interface KeyboardState {
  frame: number;
  timestamp: number;
  event: KeyEvent;
  state: KeyState;
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
