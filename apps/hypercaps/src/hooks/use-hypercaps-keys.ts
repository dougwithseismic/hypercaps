import { useEffect, useState } from "react";

interface KeyboardState {
  pressedKeys: string[];
}

export function useHyperCapsKeys() {
  const [state, setState] = useState<KeyboardState>({
    pressedKeys: [],
  });

  useEffect(() => {
    // Subscribe to keyboard events
    window.api.onKeyboardEvent((event) => {
      setState((prev) => ({ ...prev, pressedKeys: event.pressedKeys }));
    });
  }, []);

  return state;
}
