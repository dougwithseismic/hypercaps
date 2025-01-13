import { useEffect, useState } from "react";
import { ipc, createCommand } from "../lib/ipc/client";

const MODIFIER_KEYS = [
  "LShiftKey",
  "RShiftKey",
  "LControlKey",
  "RControlKey",
  "LMenu",
  "RMenu",
  "LWin",
  "RWin",
  "Capital",
  "NumLock",
  "Scroll",
  "CapsLock",
];

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

interface KeyState {
  pressedKeys: string[];
  timestamp: number;
}

interface HyperKeyConfig {
  isHyperKeyEnabled: boolean;
  trigger: string;
  modifiers: string[];
  capsLockBehavior?: "None" | "DoublePress" | "BlockToggle";
}

interface AppState {
  settings: {
    startupOnBoot: boolean;
    startMinimized: boolean;
  };
  features: Array<{
    name: string;
    isFeatureEnabled: boolean;
    enableFeatureOnStartup: boolean;
    config: any;
  }>;
}

export function useHypercapsKeys() {
  const [keyState, setKeyState] = useState<KeyState>({
    pressedKeys: [],
    timestamp: Date.now(),
  });

  const [state, setState] = useState<KeyboardState>({
    isListening: false,
    isLoading: false,
    isStarting: false,
  });

  const [hyperKeyConfig, setHyperKeyConfig] = useState<HyperKeyConfig | null>(
    null
  );
  const [fullState, setFullState] = useState<AppState | null>(null);

  // Split pressed keys into modifiers and normal keys
  const splitKeys = (keys: string[]) => {
    const modifiers: string[] = [];
    const normalKeys: string[] = [];
    keys.forEach((key) => {
      if (MODIFIER_KEYS.includes(key)) {
        modifiers.push(key);
      } else {
        normalKeys.push(key);
      }
    });
    return { keys: normalKeys, modifiers };
  };

  // Fetch initial state on mount
  useEffect(() => {
    let mounted = true;
    console.log("[useHypercapsKeys] Fetching initial state");

    // Fetch keyboard state
    const command = createCommand("keyboard", "getState");
    ipc
      .run<void, KeyboardState>(command)
      .then((initialState) => {
        if (mounted) {
          console.log("[useHypercapsKeys] Initial state:", initialState.data);
          setState((prev) => ({
            ...prev,
            ...initialState.data,
          }));
        }
      })
      .catch((error) => {
        if (mounted) {
          console.error(
            "[useHypercapsKeys] Failed to fetch initial state:",
            error
          );
        }
      });

    // Fetch HyperKey config
    window.api
      .getHyperKeyConfig()
      .then((config) => {
        if (mounted) {
          console.log("[useHypercapsKeys] HyperKey config:", config);
          setHyperKeyConfig(config);
        }
      })
      .catch((error) => {
        if (mounted) {
          console.error(
            "[useHypercapsKeys] Failed to fetch HyperKey config:",
            error
          );
        }
      });

    // Fetch full state
    window.api
      .getFullState()
      .then((state) => {
        if (mounted) {
          console.log("[useHypercapsKeys] Full state:", state);
          setFullState(state);
        }
      })
      .catch((error) => {
        if (mounted) {
          console.error(
            "[useHypercapsKeys] Failed to fetch full state:",
            error
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to state changes
  useEffect(() => {
    console.log("[useHypercapsKeys] Setting up state change listener");
    const unsubscribe = ipc.on<Partial<KeyboardState>>(
      "keyboard",
      "stateChanged",
      (event) => {
        console.log("[useHypercapsKeys] State changed:", event.data);
        setState((prev) => ({
          ...prev,
          ...event.data,
        }));
      }
    );
    return () => {
      console.log("[useHypercapsKeys] Cleaning up state change listener");
      unsubscribe();
    };
  }, []);

  // Subscribe to keyboard events
  useEffect(() => {
    console.log("[useHypercapsKeys] Setting up keyboard event listener");
    const unsubscribe = ipc.on<KeyState>("keyboard", "keyPressed", (event) => {
      console.log("[useHypercapsKeys] Key pressed:", event.data);
      setKeyState({
        pressedKeys: event.data.pressedKeys,
        timestamp: event.data.timestamp,
      });
    });
    return () => {
      console.log("[useHypercapsKeys] Cleaning up keyboard event listener");
      unsubscribe();
    };
  }, []);

  // Subscribe to HyperKey config changes
  useEffect(() => {
    console.log("[useHypercapsKeys] Setting up HyperKey config listener");
    const unsubscribe = ipc.on<HyperKeyConfig>(
      "hyperKey",
      "configChanged",
      (event) => {
        console.log("[useHypercapsKeys] HyperKey config changed:", event.data);
        setHyperKeyConfig(event.data);
      }
    );
    return () => {
      console.log("[useHypercapsKeys] Cleaning up HyperKey config listener");
      unsubscribe();
    };
  }, []);

  // Subscribe to full state changes
  useEffect(() => {
    console.log("[useHypercapsKeys] Setting up full state listener");
    const unsubscribe = ipc.on<AppState>("store", "stateChanged", (event) => {
      console.log("[useHypercapsKeys] Full state changed:", event.data);
      setFullState(event.data);
    });
    return () => {
      console.log("[useHypercapsKeys] Cleaning up full state listener");
      unsubscribe();
    };
  }, []);

  return {
    pressedKeys: keyState.pressedKeys,
    splitKeys: splitKeys(keyState.pressedKeys),
    modifierKeys: splitKeys(keyState.pressedKeys).modifiers,
    normalKeys: splitKeys(keyState.pressedKeys).keys,
    timestamp: keyState.timestamp,
    isLoading: state.isLoading,
    isListening: state.isListening,
    error: state.error,
    hyperKeyConfig,
    fullState,
  };
}
