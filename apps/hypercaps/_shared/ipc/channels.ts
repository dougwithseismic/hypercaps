export const IPC_CHANNELS = {
  KEYBOARD: {
    REGISTER_SHORTCUT: 'keyboard:register-shortcut',
    UNREGISTER_SHORTCUT: 'keyboard:unregister-shortcut',
    KEY_PRESSED: 'keyboard:key-pressed',
    KEY_RELEASED: 'keyboard:key-released',
  },
  APP: {
    QUIT: 'app:quit',
    MINIMIZE: 'app:minimize',
    TOGGLE_WINDOW: 'app:toggle-window',
  },
  CONFIG: {
    GET: 'config:get',
    SET: 'config:set',
    RESET: 'config:reset',
  },
} as const;

// Type-safe channel getter
export const getChannel = <
  TCategory extends keyof typeof IPC_CHANNELS,
  TChannel extends keyof (typeof IPC_CHANNELS)[TCategory],
>(
  category: TCategory,
  channel: TChannel
): (typeof IPC_CHANNELS)[TCategory][TChannel] => {
  return IPC_CHANNELS[category][channel];
};
