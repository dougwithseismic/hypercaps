import { useShortcutsStore } from "../store/use-shortcuts-store";
import { Command } from "@electron/features/shortcut-manager/types/input-buffer";

export function useShortcuts() {
  const {
    shortcuts,
    isEnabled,
    addShortcut,
    removeShortcut,
    updateShortcut,
    toggleEnabled,
  } = useShortcutsStore();

  return {
    shortcuts,
    isEnabled,
    addShortcut,
    removeShortcut,
    updateShortcut,
    toggleEnabled,
  };
}
