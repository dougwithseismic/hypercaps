import { create } from "zustand";
import { ipc, createCommand } from "../lib/ipc/client";
import {
  Command,
  ShortcutState,
  CreateShortcutParams,
} from "@electron/features/shortcut-manager/types/input-buffer";

interface ShortcutsStore {
  isEnabled: boolean;
  shortcuts: Command[];
  addShortcut: (shortcut: CreateShortcutParams) => Promise<void>;
  removeShortcut: (id: string) => Promise<void>;
  updateShortcut: (id: string, update: Partial<Command>) => Promise<void>;
  toggleEnabled: () => Promise<void>;
}

const useStore = create<ShortcutsStore>((set) => ({
  isEnabled: true,
  shortcuts: [],

  addShortcut: async (shortcut: CreateShortcutParams) => {
    try {
      const command = createCommand("shortcuts", "addShortcut", { shortcut });
      const response = await ipc.run<
        { shortcut: CreateShortcutParams },
        ShortcutState
      >(command);
      set({
        shortcuts: response.data.shortcuts,
        isEnabled: response.data.isEnabled,
      });
    } catch (error) {
      console.error("Failed to add shortcut:", error);
    }
  },

  removeShortcut: async (id: string) => {
    try {
      const command = createCommand("shortcuts", "removeShortcut", { id });
      const response = await ipc.run<{ id: string }, ShortcutState>(command);
      set({
        shortcuts: response.data.shortcuts,
        isEnabled: response.data.isEnabled,
      });
    } catch (error) {
      console.error("Failed to remove shortcut:", error);
    }
  },

  updateShortcut: async (id: string, update: Partial<Command>) => {
    try {
      const command = createCommand("shortcuts", "updateShortcut", {
        id,
        shortcut: update,
      });
      const response = await ipc.run<
        { id: string; shortcut: Partial<Command> },
        ShortcutState
      >(command);
      set({
        shortcuts: response.data.shortcuts,
        isEnabled: response.data.isEnabled,
      });
    } catch (error) {
      console.error("Failed to update shortcut:", error);
    }
  },

  toggleEnabled: async () => {
    try {
      const command = createCommand("shortcuts", "toggleEnabled");
      const response = await ipc.run<void, ShortcutState>(command);
      set({
        shortcuts: response.data.shortcuts,
        isEnabled: response.data.isEnabled,
      });
    } catch (error) {
      console.error("Failed to toggle shortcuts:", error);
    }
  },
}));

// Set up event listener for state changes
ipc.on<ShortcutState>(
  "shortcuts",
  "stateChanged",
  (event: { data: ShortcutState }) => {
    useStore.setState({
      shortcuts: event.data.shortcuts,
      isEnabled: event.data.isEnabled,
    });
  }
);

export function useShortcutsStore() {
  return {
    shortcuts: useStore((state) => state.shortcuts),
    isEnabled: useStore((state) => state.isEnabled),
    addShortcut: useStore((state) => state.addShortcut),
    removeShortcut: useStore((state) => state.removeShortcut),
    updateShortcut: useStore((state) => state.updateShortcut),
    toggleEnabled: useStore((state) => state.toggleEnabled),
  };
}
