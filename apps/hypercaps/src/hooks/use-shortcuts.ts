import { useEffect, useState } from "react";
import { ipc, createCommand } from "../lib/ipc/client";
import type {
  Shortcut,
  ShortcutState,
} from "@electron/features/shortcut-manager/types/shortcut";

export function useShortcuts() {
  const [state, setState] = useState<ShortcutState>({
    shortcuts: [],
    isEnabled: true,
  });

  useEffect(() => {
    // Set up IPC listeners
    const unsubscribeState = ipc.on<ShortcutState>(
      "shortcuts",
      "stateChanged",
      (event) => {
        setState(event.data);
      }
    );

    const unsubscribeTriggered = ipc.on<{
      shortcut: Shortcut;
      timestamp: number;
    }>("shortcuts", "shortcutTriggered", (event) => {
      console.log("Shortcut triggered:", event.data);
    });

    // Fetch initial state
    const fetchState = async () => {
      try {
        const command = createCommand("shortcuts", "getState");
        const response = await ipc.run<void, ShortcutState>(command);
        if (response.success) {
          setState(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch shortcut state:", error);
      }
    };
    fetchState();

    return () => {
      unsubscribeState();
      unsubscribeTriggered();
    };
  }, []);

  const addShortcut = async (shortcut: Omit<Shortcut, "id">) => {
    const command = createCommand("shortcuts", "addShortcut", { shortcut });
    const response = await ipc.run<
      { shortcut: Omit<Shortcut, "id"> },
      ShortcutState
    >(command);
    if (response.success) {
      setState(response.data);
    }
  };

  const removeShortcut = async (id: string) => {
    const command = createCommand("shortcuts", "removeShortcut", { id });
    const response = await ipc.run<{ id: string }, ShortcutState>(command);
    if (response.success) {
      setState(response.data);
    }
  };

  const updateShortcut = async (
    id: string,
    shortcut: Partial<Omit<Shortcut, "id">>
  ) => {
    const command = createCommand("shortcuts", "updateShortcut", {
      id,
      shortcut,
    });
    const response = await ipc.run<
      { id: string; shortcut: Partial<Omit<Shortcut, "id">> },
      ShortcutState
    >(command);
    if (response.success) {
      setState(response.data);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    const command = createCommand("shortcuts", "toggleEnabled", { enabled });
    const response = await ipc.run<{ enabled: boolean }, ShortcutState>(
      command
    );
    if (response.success) {
      setState(response.data);
    }
  };

  return {
    shortcuts: state.shortcuts,
    isEnabled: state.isEnabled,
    addShortcut,
    removeShortcut,
    updateShortcut,
    toggleEnabled,
  };
}
