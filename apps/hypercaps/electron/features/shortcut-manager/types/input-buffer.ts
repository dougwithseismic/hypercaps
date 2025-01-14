export interface KeyEvent {
  key: string;
  type: 'press' | 'release';
  timestamp: number;
}

export interface KeyState {
  key: string;
  state: 'idle' | 'justPressed' | 'held' | 'released';
  initialPressTime: number;
  holdDuration: number;
  lastUpdateTime: number;
}

export interface InputFrame {
  id: number;
  timestamp: number;
  justPressed: Set<string>;
  heldKeys: Set<string>;
  justReleased: Set<string>;
  holdDurations: Map<string, number>;
}

export interface CommandPattern {
  sequence: Array<{
    type: 'press' | 'hold' | 'release' | 'combo';
    keys: string[];
    holdTime?: number;
    window?: number;
    strict?: boolean;
  }>;
  window: number;
  strict?: boolean;
}

export interface Command {
  id: string;
  pattern: CommandPattern;
  cooldown?: number;
}

export interface CommandMatch {
  command: Command;
  events: KeyEvent[];
  startTime: number;
  endTime: number;
  holdDurations?: Map<string, number>;
}
