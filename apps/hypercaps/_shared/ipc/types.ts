import { IPC_CHANNELS } from './channels';

// Base IPC Message type
export interface IPCMessage<T = unknown> {
  channel: (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS][keyof (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]];
  payload: T;
}

// Keyboard Message Types
export interface KeyboardShortcut {
  id: string;
  keys: string[];
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
}

export interface KeyboardEvent {
  key: string;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    win: boolean;
  };
  timestamp: number;
}

// Config Message Types
export interface ConfigData {
  key: string;
  value: unknown;
}

// Type Guards
export const isKeyboardEvent = (data: unknown): data is KeyboardEvent => {
  const event = data as KeyboardEvent;
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof event.key === 'string' &&
    typeof event.modifiers === 'object' &&
    typeof event.timestamp === 'number'
  );
};
