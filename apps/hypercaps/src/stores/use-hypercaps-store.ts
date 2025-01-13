import { create } from "zustand";
import { AppState } from "../../electron/services/store";

interface StoreState {
  state: AppState | null;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setState: (state: AppState) => void;
  getFullState: typeof window.api.getFullState;
  getMappings: typeof window.api.getMappings;
  addMapping: typeof window.api.addMapping;
  updateMapping: typeof window.api.updateMapping;
  deleteMapping: typeof window.api.deleteMapping;
  getHyperKeyConfig: typeof window.api.getHyperKeyConfig;
  setHyperKeyConfig: typeof window.api.setHyperKeyConfig;
  getStartupSettings: typeof window.api.getStartupSettings;
  setStartupOnBoot: typeof window.api.setStartupOnBoot;
  setEnableOnStartup: typeof window.api.setEnableOnStartup;
}

export const useHyperCapsStore = create<StoreState>((set) => {
  // Initialize store
  window.api.getFullState().then((initialState) => {
    set({ state: initialState, loading: false });
  });

  // Subscribe to updates
  window.api.onStoreStateUpdate((newState) => {
    set({ state: newState });
  });

  return {
    state: null,
    loading: true,
    setLoading: (loading) => set({ loading }),
    setState: (state) => set({ state }),
    getFullState: window.api.getFullState,
    getMappings: window.api.getMappings,
    addMapping: window.api.addMapping,
    updateMapping: window.api.updateMapping,
    deleteMapping: window.api.deleteMapping,
    getHyperKeyConfig: window.api.getHyperKeyConfig,
    setHyperKeyConfig: window.api.setHyperKeyConfig,
    getStartupSettings: window.api.getStartupSettings,
    setStartupOnBoot: window.api.setStartupOnBoot,
    setEnableOnStartup: window.api.setEnableOnStartup,
  };
});
