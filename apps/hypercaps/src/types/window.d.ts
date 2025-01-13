import { HyperKeyConfig, KeyMapping } from "../../electron/services/types";

interface KeyboardEvent {
  pressedKeys: string[];
  timestamp: number;
}

declare global {
  interface Window {
    api: {
      // Keyboard service methods
      startListening: () => void;
      stopListening: () => void;
      onKeyboardEvent: (callback: (event: any) => void) => void;
      onKeyboardServiceState: (callback: (enabled: boolean) => void) => void;
      onKeyboardServiceLoading: (callback: (loading: boolean) => void) => void;

      // Mapping methods
      getMappings: () => Promise<KeyMapping[]>;
      addMapping: (mapping: Omit<KeyMapping, "id">) => Promise<KeyMapping>;
      updateMapping: (
        id: string,
        updates: Partial<KeyMapping>
      ) => Promise<KeyMapping>;
      deleteMapping: (id: string) => Promise<void>;

      // HyperKey config
      getHyperKeyConfig: () => Promise<HyperKeyConfig>;
      setHyperKeyConfig: (config: HyperKeyConfig) => Promise<void>;
      restartWithConfig: (config: HyperKeyConfig) => Promise<void>;
      onHyperKeyState: (callback: (config: HyperKeyConfig) => void) => void;

      // Startup settings
      getStartupSettings: () => Promise<{
        startOnBoot: boolean;
        enableOnStartup: boolean;
      }>;
      setStartupOnBoot: (enabled: boolean) => Promise<void>;
      setEnableOnStartup: (enabled: boolean) => Promise<void>;
    };
    electron: {
      minimize: () => void;
      close: () => void;
    };
  }
}
