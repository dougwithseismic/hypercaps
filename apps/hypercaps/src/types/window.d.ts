import { AppState } from '@electron/features/shortcut-manager/services/store/types/app-state';
import { HyperKeyFeatureConfig } from '@electron/features/hyperkeys/types/hyperkey-feature';
import { Shortcut } from '@electron/features/shortcut-manager/types/shortcut';

interface StartupSettings {
  startupOnBoot: boolean;
  startMinimized: boolean;
}

declare global {
  interface Window {
    api: {
      // Window controls
      minimizeWindow: () => void;
      closeWindow: () => void;

      // Keyboard service
      startListening: () => void;
      stopListening: () => void;
      isListening: () => Promise<boolean>;

      // HyperKey feature
      getHyperKeyConfig: () => Promise<HyperKeyFeatureConfig>;
      setHyperKeyConfig: (config: HyperKeyFeatureConfig) => Promise<void>;

      // App settings
      getStartupSettings: () => Promise<StartupSettings>;
      setStartupOnBoot: (enabled: boolean) => Promise<void>;
      setStartMinimized: (enabled: boolean) => Promise<void>;

      // Store state
      getFullState: () => Promise<AppState>;

      // Event listeners
      onKeyboardEvent: (callback: (event: any) => void) => void;
      onKeyboardServiceState: (callback: (event: any) => void) => void;
      onHyperKeyState: (callback: (event: any) => void) => void;

      // Shortcut manager
      getShortcuts: () => Promise<Shortcut[]>;
      addShortcut: (shortcut: Shortcut) => Promise<void>;
      removeShortcut: (id: string) => Promise<void>;
      updateShortcut: (id: string, shortcut: Shortcut) => Promise<void>;
      toggleShortcut: (id: string) => Promise<void>;
    };
  }
}

export {};
