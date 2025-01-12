interface KeyboardEvent {
  pressedKeys: string[];
  rawPressedKeys: string[];
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  capsLock: boolean;
  hyperKeyActive: boolean;
}

interface HyperKeyConfig {
  enabled: boolean;
  trigger: string;
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
}

interface KeyMapping {
  id: string;
  sourceKey: string;
  targetModifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
  targetKey?: string;
  command?: string;
  enabled: boolean;
}

interface Window {
  api: {
    startListening: () => void;
    stopListening: () => void;
    onKeyboardEvent: (callback: (event: KeyboardEvent) => void) => void;
    onKeyboardServiceState: (callback: (enabled: boolean) => void) => void;
    onKeyboardServiceLoading: (callback: (loading: boolean) => void) => void;
    getMappings: () => Promise<KeyMapping[]>;
    addMapping: (mapping: Omit<KeyMapping, "id">) => Promise<KeyMapping>;
    updateMapping: (
      id: string,
      updates: Partial<KeyMapping>
    ) => Promise<KeyMapping>;
    deleteMapping: (id: string) => Promise<void>;
    getHyperKeyConfig: () => Promise<HyperKeyConfig>;
    setHyperKeyConfig: (config: HyperKeyConfig) => Promise<void>;
    onHyperKeyConfigChange: (
      callback: (config: HyperKeyConfig) => void
    ) => void;

    // Startup settings
    getStartupSettings: () => Promise<{
      startupOnBoot: boolean;
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
