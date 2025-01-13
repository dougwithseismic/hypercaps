import { create } from "zustand";
import { ipc, createCommand } from "../lib/ipc/client";
import { AppState } from "@electron/services/store/types/app-state";
import { HyperKeyFeatureConfig } from "@electron/services/types";

interface KeyState {
  pressedKeys: string[];
  timestamp: number;
}

interface KeyboardState {
  isListening: boolean;
  isLoading: boolean;
  isStarting: boolean;
  error?: string;
  lastError?: {
    message: string;
    timestamp: number;
  };
}

interface HypercapsState {
  // State
  keyState: KeyState;
  keyboardState: KeyboardState;
  hyperKeyConfig: HyperKeyFeatureConfig | null;
  fullState: AppState | null;

  // Actions
  initialize: () => Promise<void>;
  setKeyState: (state: KeyState) => void;
  setKeyboardState: (state: Partial<KeyboardState>) => void;
  setHyperKeyConfig: (config: HyperKeyFeatureConfig) => void;
  setFullState: (state: AppState) => void;
}

// Make the store private
const useStore = create<HypercapsState>((set, _get) => ({
  // Initial state
  keyState: {
    pressedKeys: [],
    timestamp: Date.now(),
  },
  keyboardState: {
    isListening: false,
    isLoading: false,
    isStarting: false,
  },
  hyperKeyConfig: null,
  fullState: null,

  // Actions
  initialize: async () => {
    // Set up IPC listeners
    ipc.on<KeyState>("keyboard", "keyPressed", (event) => {
      set({ keyState: event.data });
    });

    ipc.on<Partial<KeyboardState>>("keyboard", "stateChanged", (event) => {
      set((state) => ({
        keyboardState: { ...state.keyboardState, ...event.data },
      }));
    });

    ipc.on<HyperKeyFeatureConfig>("hyperKey", "configChanged", (event) => {
      set({ hyperKeyConfig: event.data });
    });

    ipc.on<AppState>("store", "stateChanged", (event) => {
      set({ fullState: event.data });
    });

    // Fetch initial state
    try {
      // Fetch keyboard state
      const command = createCommand("keyboard", "getState");
      const initialState = await ipc.run<void, KeyboardState>(command);
      set((state) => ({
        keyboardState: { ...state.keyboardState, ...initialState.data },
      }));

      // Fetch HyperKey config
      const config = await window.api.getHyperKeyConfig();
      set({ hyperKeyConfig: config });

      // Fetch full state
      const fullState = await window.api.getFullState();
      set({ fullState });
    } catch (error) {
      console.error("[HypercapsStore] Failed to initialize:", error);
      set((state) => ({
        keyboardState: {
          ...state.keyboardState,
          error:
            error instanceof Error ? error.message : "Failed to initialize",
        },
      }));
    }
  },

  setKeyState: (state) => set({ keyState: state }),
  setKeyboardState: (updates) =>
    set((state) => ({
      keyboardState: { ...state.keyboardState, ...updates },
    })),
  setHyperKeyConfig: (config) => set({ hyperKeyConfig: config }),
  setFullState: (state) => set({ fullState: state }),
}));

// Export a hook with only the state we want to expose
export function useHypercapsStore() {
  return {
    keyState: useStore((state) => state.keyState),
    keyboardState: useStore((state) => state.keyboardState),
    hyperKeyConfig: useStore((state) => state.hyperKeyConfig),
    fullState: useStore((state) => state.fullState),
    initialize: useStore((state) => state.initialize),
  };
}
