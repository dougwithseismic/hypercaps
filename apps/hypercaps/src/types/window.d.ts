import {
  HyperKeyFeatureConfig,
  KeyMapping,
} from "../../electron/services/types";
import { AppState } from "../../electron/services/store";

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
      onKeyboardEvent: (callback: (event: KeyboardEvent) => void) => void;
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
      getHyperKeyConfig: () => Promise<HyperKeyFeatureConfig>;
      setHyperKeyConfig: (config: HyperKeyFeatureConfig) => Promise<void>;
      restartWithConfig: (config: HyperKeyFeatureConfig) => Promise<void>;
      onHyperKeyState: (
        callback: (config: HyperKeyFeatureConfig) => void
      ) => void;

      // Startup settings
      getStartupSettings: () => Promise<{
        startOnBoot: boolean;
        enableOnStartup: boolean;
      }>;
      setStartupOnBoot: (enabled: boolean) => Promise<void>;
      setEnableOnStartup: (enabled: boolean) => Promise<void>;

      // Store state
      getFullState: () => Promise<AppState>;
      onStoreStateUpdate: (callback: (state: AppState) => void) => void;
    };
    electron: {
      minimize: () => void;
      close: () => void;
    };
  }
}
