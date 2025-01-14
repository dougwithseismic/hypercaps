export interface KeyEvent {
  key: string;
  type: "press" | "release";
  timestamp: number;
}

export interface CommandPattern {
  sequence: { keys: string[]; window: number }[];
  window: number;
}

export interface Command {
  id: string;
  name: string;
  enabled: boolean;
  pattern: CommandPattern;
  action: Action;
  cooldown?: number;
}

export interface CommandMatch {
  command: Command;
  events: KeyEvent[];
  startTime: number;
  endTime: number;
}

export interface Action {
  type: "launch" | "command";
  program?: string;
  command?: string;
}

export interface ShortcutState {
  isEnabled: boolean;
  shortcuts: Command[];
}

// Simple type for creating new shortcuts
export type CreateShortcutParams = Omit<Command, "id">;
