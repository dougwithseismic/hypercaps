import { useEffect } from "react";
import { useHypercapsStore } from "../store/use-hypercaps-store";

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

export function useHypercapsKeys() {
  const { keyState, keyboardState, hyperKeyConfig, fullState, initialize } =
    useHypercapsStore();

  // Initialize store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

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

  return {
    pressedKeys: keyState.pressedKeys,
    splitKeys: splitKeys(keyState.pressedKeys),
    modifierKeys: splitKeys(keyState.pressedKeys).modifiers,
    normalKeys: splitKeys(keyState.pressedKeys).keys,
    timestamp: keyState.timestamp,
    isLoading: keyboardState.isLoading,
    isListening: keyboardState.isListening,
    error: keyboardState.error,
    hyperKeyConfig,
    fullState,
  };
}
