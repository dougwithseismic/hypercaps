import { AppState } from "../../electron/services/store";

declare global {
  interface Window {
    api: {
      // Existing API methods
      startListening: () => void;
      stopListening: () => void;
      onKeyboardEvent: (callback: (event: any) => void) => void;
      onKeyboardServiceState: (callback: (enabled: boolean) => void) => void;
      onKeyboardServiceLoading: (callback: (loading: boolean) => void) => void;
      getMappings: () => Promise<any[]>;
      addMapping: (mapping: any) => Promise<any>;
      updateMapping: (id: string, updates: any) => Promise<any>;
      deleteMapping: (id: string) => Promise<void>;
      getHyperKeyConfig: () => Promise<any>;
      setHyperKeyConfig: (config: any) => Promise<void>;
      restartWithConfig: (config: any) => Promise<void>;
      onHyperKeyState: (callback: (config: any) => void) => void;
      getStartupSettings: () => Promise<{
        startupOnBoot: boolean;
        enableOnStartup: boolean;
      }>;
      setStartupOnBoot: (enabled: boolean) => Promise<void>;
      setEnableOnStartup: (enabled: boolean) => Promise<void>;

      // Store state methods
      getFullState: () => Promise<AppState>;
      onStoreStateUpdate: (callback: (state: AppState) => void) => void;
    };
    electron: {
      minimize: () => void;
      close: () => void;
    };
  }
}

export {};
