import { create } from 'zustand';
import { IPCCommand } from '@hypercaps/ipc';
import { KeyState } from '@electron/features/hyperkeys/types/keyboard-state';

interface KeyboardState {
  isActive: boolean;
  pressedKeys: string[];
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    win: boolean;
  };
}

class IPCClient {
  async run<TParams = unknown, TResult = unknown>(
    command: IPCCommand<TParams>
  ): Promise<TResult> {
    const result = await window.api.ipc.run<TParams, TResult>(command);
    if (!result.success || result.data === undefined) {
      throw new Error(result.error?.message || 'IPC command failed');
    }
    return result.data;
  }

  on<TData = unknown>(
    service: string,
    event: string,
    callback: (data: TData) => void
  ): () => void {
    return window.api.ipc.on<TData>(service, event, callback);
  }
}

export const ipcClient = new IPCClient();

interface HypercapsState {
  isActive: boolean;
  pressedKeys: Set<string>;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    win: boolean;
  };
  keyBuffer: KeyState;
  setKeyBuffer: (keyBuffer: KeyState) => void;
  setIsActive: (isActive: boolean) => void;
  setPressedKeys: (keys: Set<string>) => void;
  setModifiers: (modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    win: boolean;
  }) => void;
}

export const useHypercapsStore = create<HypercapsState>((set) => ({
  isActive: false,
  pressedKeys: new Set(),
  modifiers: {
    ctrl: false,
    alt: false,
    shift: false,
    win: false,
  },
  keyBuffer: {
    justPressed: [],
    held: [],
    justReleased: [],
    holdDurations: {},
  },
  setKeyBuffer: (keyBuffer) => set({ keyBuffer }),
  setIsActive: (isActive) => set({ isActive }),
  setPressedKeys: (keys) => set({ pressedKeys: keys }),
  setModifiers: (modifiers) => set({ modifiers }),
}));

// Connect IPC events to Zustand store
ipcClient.on<KeyboardState>('keyboard', 'stateChanged', (state) => {
  console.log('[Client]: stateChanged', state);
});

ipcClient.on<{ state: KeyState }>('keyboard', 'frame', ({ state }) => {
  console.log('[Client]: frame', state);
  useHypercapsStore.getState().setKeyBuffer(state);
});
