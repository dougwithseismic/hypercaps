export interface Shortcut {
  id: string;
  name: string;
  triggerKey: string;
  action: {
    type: "launch";
    program: string;
  };
  enabled: boolean;
}

export interface ShortcutState {
  shortcuts: Shortcut[];
  isEnabled: boolean;
}

export interface ShortcutCommands {
  addShortcut: {
    shortcut: Omit<Shortcut, "id">;
  };
  removeShortcut: {
    id: string;
  };
  updateShortcut: {
    id: string;
    shortcut: Partial<Omit<Shortcut, "id">>;
  };
  toggleEnabled: {
    enabled: boolean;
  };
  getState: void;
}

export interface ShortcutEvents {
  stateChanged: ShortcutState;
  shortcutTriggered: {
    shortcut: Shortcut;
    timestamp: number;
  };
}

export type ShortcutManagerService = {
  commands: ShortcutCommands;
  events: ShortcutEvents;
};
