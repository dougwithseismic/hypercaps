// Keyboard Key Types
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'win';
export type KeyState = 'pressed' | 'released';

export interface KeyCombo {
  key: string;
  modifiers: Partial<Record<ModifierKey, boolean>>;
}

export interface KeyboardFrameState {
  pressedKeys: Set<string>;
  modifiers: Record<ModifierKey, boolean>;
  lastKeyTimestamp: number;
}

// Keyboard Action Types
export type KeyboardAction =
  | {
      type: 'sendKeys';
      keys: string[];
    }
  | {
      type: 'runCommand';
      command: string;
    }
  | {
      type: 'toggleCapsLock';
    }
  | {
      type: 'custom';
      handler: () => void;
    };

// Keyboard Configuration Types
export interface KeyboardConfig {
  shortcuts: KeyboardShortcut[];
  globalEnabled: boolean;
  debounceTime: number;
}

export interface KeyboardShortcut {
  id: string;
  name: string;
  description?: string;
  keyCombo: KeyCombo;
  action: KeyboardAction;
  enabled: boolean;
}

// Type Guards
export const isModifierKey = (key: string): key is ModifierKey => {
  return ['ctrl', 'alt', 'shift', 'win'].includes(key);
};
