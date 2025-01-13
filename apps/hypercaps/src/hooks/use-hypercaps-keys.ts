import { useEffect, useState } from "react";
import { ipc, createCommand } from "../lib/ipc/client";

interface KeyboardState {
  isListening: boolean;
  isLoading: boolean;
  isStarting: boolean;
  isRunning: boolean;
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

export function useHypercapsKeys() {
  const [keyState, setKeyState] = useState<KeyState>({
    pressedKeys: [],
    timestamp: Date.now(),
  });

  const [state, setState] = useState<KeyboardState>({
    isListening: false,
    isLoading: false,
    isStarting: false,
    isRunning: false,
  });

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
      setKeyState(event.data);
    });
    return () => {
      console.log("[useHypercapsKeys] Cleaning up keyboard event listener");
      unsubscribe();
    };
  }, []);

  // Start keyboard service
  useEffect(() => {
    let isSubscribed = true;
    console.log("[useHypercapsKeys] Starting keyboard service");

    const command = createCommand("keyboard", "start");
    ipc
      .run(command)
      .then(() => {
        if (isSubscribed) {
          console.log("[useHypercapsKeys] Keyboard service started");
        }
      })
      .catch((error: Error) => {
        if (isSubscribed) {
          console.error(
            "[useHypercapsKeys] Failed to start keyboard service:",
            error
          );
        }
      });

    return () => {
      isSubscribed = false;
      console.log("[useHypercapsKeys] Stopping keyboard service");
      const stopCommand = createCommand("keyboard", "stop");
      ipc.run(stopCommand).catch((error: Error) => {
        console.error(
          "[useHypercapsKeys] Failed to stop keyboard service:",
          error
        );
      });
    };
  }, []);

  return {
    pressedKeys: keyState.pressedKeys,
    timestamp: keyState.timestamp,
    isRunning: state.isRunning,
    isLoading: state.isLoading,
    error: state.error,
  };
}
