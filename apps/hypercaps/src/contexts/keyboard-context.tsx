import React, { createContext, useContext, useState, useEffect } from "react";

interface KeyboardState {
  isEnabled: boolean;
  currentKeys: string[];
  modifiers: {
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    capsLock: boolean;
  };
}

interface KeyboardContextType {
  state: KeyboardState;
  toggleService: () => void;
}

const initialState: KeyboardState = {
  isEnabled: true,
  currentKeys: [],
  modifiers: {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    capsLock: false,
  },
};

const KeyboardContext = createContext<KeyboardContextType | undefined>(
  undefined
);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KeyboardState>(initialState);

  useEffect(() => {
    // Start listening when component mounts
    window.api.startListening();

    // Listen for keyboard events
    window.api.onKeyboardEvent((event) => {
      setState((prev) => ({
        ...prev,
        currentKeys: Array.isArray(event.pressedKeys) ? event.pressedKeys : [],
        modifiers: {
          ctrlKey: Boolean(event.ctrlKey),
          altKey: Boolean(event.altKey),
          shiftKey: Boolean(event.shiftKey),
          metaKey: Boolean(event.metaKey),
          capsLock: Boolean(event.capsLock),
        },
      }));
    });

    // Listen for service state changes
    window.api.onKeyboardServiceState((enabled) => {
      setState((prev) => ({
        ...prev,
        isEnabled: Boolean(enabled),
      }));
    });

    return () => {
      window.api.stopListening();
    };
  }, []);

  const toggleService = () => {
    if (state.isEnabled) {
      window.api.stopListening();
    } else {
      window.api.startListening();
    }
  };

  return (
    <KeyboardContext.Provider value={{ state, toggleService }}>
      {children}
    </KeyboardContext.Provider>
  );
}

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (context === undefined) {
    throw new Error("useKeyboard must be used within a KeyboardProvider");
  }
  return context;
}