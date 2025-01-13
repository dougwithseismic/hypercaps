import { create } from "zustand";
import { HyperKeyConfig, KeyMapping } from "../../electron/services/types";

interface KeyboardEvent {
  pressedKeys: string[];
  timestamp: number;
}

interface KeyboardServiceState {
  // Service state
  isEnabled: boolean;
  isLoading: boolean;
  // HyperKey state
  hyperKeyConfig: HyperKeyConfig;
  // Key events
  lastKeyboardEvent: KeyboardEvent | null;
  // Mappings
  mappings: KeyMapping[];
  // Actions
  setIsEnabled: (isEnabled: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setHyperKeyConfig: (config: HyperKeyConfig) => void;
  setLastKeyboardEvent: (event: KeyboardEvent) => void;
  setMappings: (mappings: KeyMapping[]) => void;
  // IPC methods
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  restartWithConfig: (config: HyperKeyConfig) => Promise<void>;
  addMapping: (mapping: Omit<KeyMapping, "id">) => Promise<void>;
  updateMapping: (id: string, updates: Partial<KeyMapping>) => Promise<void>;
  deleteMapping: (id: string) => Promise<void>;
}

export const useKeyboardService = create<KeyboardServiceState>((set, get) => ({
  // Initial state
  isEnabled: false,
  isLoading: false,
  hyperKeyConfig: {
    enabled: false,
    trigger: "CapsLock",
    modifiers: [],
  },
  lastKeyboardEvent: null,
  mappings: [],

  // State setters
  setIsEnabled: (isEnabled) => set({ isEnabled }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setHyperKeyConfig: (config) => set({ hyperKeyConfig: config }),
  setLastKeyboardEvent: (event) => set({ lastKeyboardEvent: event }),
  setMappings: (mappings) => set({ mappings }),

  // IPC methods
  startListening: async () => {
    const { setIsLoading } = get();
    setIsLoading(true);
    try {
      await window.api.startListening();
    } finally {
      setIsLoading(false);
    }
  },

  stopListening: async () => {
    await window.api.stopListening();
  },

  restartWithConfig: async (config) => {
    const { setIsLoading, setHyperKeyConfig } = get();
    setIsLoading(true);
    try {
      await window.api.restartWithConfig(config);
      setHyperKeyConfig(config);
    } finally {
      setIsLoading(false);
    }
  },

  addMapping: async (mapping) => {
    const { setMappings, mappings } = get();
    const newMapping = await window.api.addMapping(mapping);
    setMappings([...mappings, newMapping]);
  },

  updateMapping: async (id, updates) => {
    const { setMappings, mappings } = get();
    const updatedMapping = await window.api.updateMapping(id, updates);
    setMappings(mappings.map((m) => (m.id === id ? updatedMapping : m)));
  },

  deleteMapping: async (id) => {
    const { setMappings, mappings } = get();
    await window.api.deleteMapping(id);
    setMappings(mappings.filter((m) => m.id !== id));
  },
}));
// Set up IPC listeners
window.api.onKeyboardEvent((event) => {
  useKeyboardService.getState().setLastKeyboardEvent(event);
});

window.api.onKeyboardServiceState((isEnabled) => {
  useKeyboardService.getState().setIsEnabled(isEnabled);
});

window.api.onKeyboardServiceLoading((isLoading) => {
  useKeyboardService.getState().setIsLoading(isLoading);
});

window.api.onHyperKeyState((config) => {
  useKeyboardService.getState().setHyperKeyConfig(config);
});
