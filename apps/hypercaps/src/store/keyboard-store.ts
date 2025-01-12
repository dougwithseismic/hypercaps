import { create } from "zustand";

interface KeyboardState {
  isEnabled: boolean;
  isLoading: boolean;
  currentKeys: string[];
  modifiers: {
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    capsLock: boolean;
    hyperKeyActive: boolean;
  };
  hyperKeyConfig: {
    enabled: boolean;
    trigger: string;
    modifiers: {
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      win?: boolean;
    };
  } | null;
}

interface KeyboardStore extends KeyboardState {
  toggleService: () => Promise<void>;
  setKeyboardState: (state: Partial<KeyboardState>) => void;
  loadHyperKeyConfig: () => Promise<void>;
  updateHyperKeyConfig: (
    config: KeyboardState["hyperKeyConfig"]
  ) => Promise<void>;
}

const initialState: KeyboardState = {
  isEnabled: true,
  isLoading: false,
  currentKeys: [],
  modifiers: {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    capsLock: false,
    hyperKeyActive: false,
  },
  hyperKeyConfig: null,
};

export const useKeyboardStore = create<KeyboardStore>()((set) => ({
  ...initialState,

  toggleService: async () => {
    set({ isLoading: true });
    const { isEnabled } = useKeyboardStore.getState();
    if (isEnabled) {
      await window.api.stopListening();
    } else {
      await window.api.startListening();
    }
  },

  setKeyboardState: (newState) => set((state) => ({ ...state, ...newState })),

  loadHyperKeyConfig: async () => {
    try {
      const config = await window.api.getHyperKeyConfig();
      set({ hyperKeyConfig: config });
    } catch (err) {
      console.error("Failed to load HyperKey config:", err);
    }
  },

  updateHyperKeyConfig: async (config) => {
    if (!config) return;
    try {
      await window.api.setHyperKeyConfig(config);
      set({ hyperKeyConfig: config });
    } catch (err) {
      console.error("Failed to update HyperKey config:", err);
    }
  },
}));

// Setup IPC listeners
if (typeof window !== "undefined") {
  window.api.onKeyboardEvent((event) => {
    useKeyboardStore.setState({
      currentKeys: Array.isArray(event.pressedKeys) ? event.pressedKeys : [],
      modifiers: {
        ctrlKey: Boolean(event.ctrlKey),
        altKey: Boolean(event.altKey),
        shiftKey: Boolean(event.shiftKey),
        metaKey: Boolean(event.metaKey),
        capsLock: Boolean(event.capsLock),
        hyperKeyActive: Boolean(event.hyperKeyActive),
      },
    });
  });

  window.api.onKeyboardServiceState((enabled) => {
    useKeyboardStore.setState({
      isEnabled: Boolean(enabled),
      isLoading: false,
    });
  });

  window.api.onKeyboardServiceLoading((loading) => {
    useKeyboardStore.setState({
      isLoading: loading,
    });
  });

  // Load initial HyperKey config
  useKeyboardStore.getState().loadHyperKeyConfig();
}
