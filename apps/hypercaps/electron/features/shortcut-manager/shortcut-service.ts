import { Store } from "../../services/store";
import { IPCService } from "../../services/ipc";
import { KeyboardEvents } from "../hyperkeys/types/keyboard-ipc";
import { AppState } from "../../services/store/types/app-state";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { InputBufferMatcher } from "./input-buffer-matcher";
import {
  Command,
  ShortcutState,
  KeyEvent,
  CommandMatch,
  Action,
} from "./types/input-buffer";

export class ShortcutService {
  private store: Store;
  private ipc: IPCService;
  private matcher: InputBufferMatcher;
  private relevantKeys: Set<string>;
  private lastExecutions: Map<string, number>;

  constructor() {
    this.store = Store.getInstance();
    this.ipc = IPCService.getInstance();
    this.matcher = new InputBufferMatcher(8, 1000); // 8 events, 1 second
    this.relevantKeys = new Set<string>();
    this.lastExecutions = new Map();
    this.setupIPCHandlers();
  }

  private setupIPCHandlers(): void {
    this.ipc.registerHandler("keyboard", "keyPressed", async (data) => {
      const keyboardEvent = data as KeyboardEvents["keyPressed"];
      await this.handleKeyboardEvent(keyboardEvent);
    });
  }

  async initialize(): Promise<void> {
    console.log("[ShortcutService] Initializing...");

    try {
      // Get current state
      const feature = await this.store.getFeature("shortcutManager");

      // Initialize feature in store if it doesn't exist
      if (!feature) {
        await this.store.update((draft: AppState) => {
          draft.features.push({
            name: "shortcutManager",
            isFeatureEnabled: true,
            enableFeatureOnStartup: true,
            config: {
              isEnabled: true,
              shortcuts: [],
            },
          });
        });
      }

      // Initialize relevant keys from existing shortcuts
      const state = (await this.store.getFeature("shortcutManager"))
        ?.config as ShortcutState;
      if (state?.shortcuts) {
        state.shortcuts.forEach((shortcut) => {
          if (shortcut.enabled) {
            this.addRelevantKeys(shortcut.pattern.sequence);
          }
        });
      }

      console.log("[ShortcutService] Initialized with state:", state);
    } catch (error) {
      console.error("[ShortcutService] Initialization error:", error);
    }
  }

  private async handleKeyboardEvent(
    data: KeyboardEvents["keyPressed"]
  ): Promise<void> {
    const state = (await this.store.getFeature("shortcutManager"))
      ?.config as ShortcutState;
    if (!state?.isEnabled) return;

    const pressedKeys = new Set(data.pressedKeys);
    console.log(
      "[ShortcutService] Handling key event:",
      Array.from(pressedKeys),
      "at",
      data.timestamp
    );

    // Skip if no keys are pressed
    if (pressedKeys.size === 0) return;

    // Add events to buffer
    for (const key of pressedKeys) {
      const event: KeyEvent = {
        key,
        type: "press",
        timestamp: data.timestamp,
      };
      this.matcher.addEvent(event);
    }

    // Find and execute matches
    const enabledShortcuts = state.shortcuts.filter((s) => s.enabled);
    const matches = this.matcher.findMatches(enabledShortcuts, data.timestamp);

    // Execute matched shortcuts
    for (const match of matches) {
      await this.executeShortcut(match);
    }
  }

  private async executeShortcut(match: CommandMatch): Promise<void> {
    const now = Date.now();
    const lastExecution = this.lastExecutions.get(match.command.id) || 0;
    const cooldown = match.command.cooldown || 500; // Default 500ms cooldown

    if (now - lastExecution < cooldown) {
      console.log(
        `[ShortcutService] Skipping execution of ${match.command.name} - in cooldown`
      );
      return;
    }

    console.log(`[ShortcutService] Executing shortcut: ${match.command.name}`);
    this.lastExecutions.set(match.command.id, now);

    try {
      if (match.command.action.type === "launch") {
        exec(match.command.action.program, (error) => {
          if (error) {
            console.error(
              `[ShortcutService] Error executing shortcut: ${error}`
            );
          }
        });
      } else if (match.command.action.type === "command") {
        exec(match.command.action.command, (error) => {
          if (error) {
            console.error(
              `[ShortcutService] Error executing command: ${error}`
            );
          }
        });
      }
    } catch (error) {
      console.error("[ShortcutService] Error executing shortcut:", error);
    }
  }

  private addRelevantKeys(sequence: (string | { keys: string[] })[]): void {
    sequence.forEach((item) => {
      if (typeof item === "string") {
        this.relevantKeys.add(item);
      } else {
        item.keys.forEach((key) => this.relevantKeys.add(key));
      }
    });
  }

  private removeRelevantKeys(
    sequence: (string | { keys: string[] })[],
    id: string,
    shortcuts: Command[]
  ): void {
    const allKeys = sequence.flatMap((item) =>
      typeof item === "string" ? [item] : item.keys
    );

    allKeys.forEach((key) => {
      let isUsedElsewhere = false;
      for (const other of shortcuts) {
        if (other.id !== id && other.enabled) {
          const otherKeys = other.pattern.sequence.flatMap((seq) =>
            typeof seq === "string" ? [seq] : seq.keys
          );
          if (otherKeys.includes(key)) {
            isUsedElsewhere = true;
            break;
          }
        }
      }
      if (!isUsedElsewhere) {
        this.relevantKeys.delete(key);
      }
    });
  }

  async addShortcut(command: Omit<Command, "id">): Promise<void> {
    const newShortcut: Command = {
      ...command,
      id: uuidv4(),
    };

    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === "shortcutManager");
      if (feature) {
        (feature.config as ShortcutState).shortcuts.push(newShortcut);
      }
    });

    if (newShortcut.enabled) {
      this.addRelevantKeys(newShortcut.pattern.sequence);
    }
  }

  async removeShortcut(id: string): Promise<void> {
    const state = (await this.store.getFeature("shortcutManager"))
      ?.config as ShortcutState;
    const shortcut = state.shortcuts.find((s) => s.id === id);

    if (shortcut) {
      this.removeRelevantKeys(shortcut.pattern.sequence, id, state.shortcuts);
    }

    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === "shortcutManager");
      if (feature) {
        const state = feature.config as ShortcutState;
        state.shortcuts = state.shortcuts.filter((s) => s.id !== id);
      }
    });
  }

  async updateShortcut(id: string, update: Partial<Command>): Promise<void> {
    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === "shortcutManager");
      if (feature) {
        const state = feature.config as ShortcutState;
        const index = state.shortcuts.findIndex((s) => s.id === id);
        if (index !== -1) {
          const oldShortcut = state.shortcuts[index];
          state.shortcuts[index] = { ...oldShortcut, ...update };

          // Update relevant keys if pattern or enabled state changed
          if (update.pattern || update.enabled !== undefined) {
            // Remove old keys
            this.removeRelevantKeys(
              oldShortcut.pattern.sequence,
              id,
              state.shortcuts
            );

            // Add new keys
            const updatedShortcut = state.shortcuts[index];
            if (updatedShortcut.enabled) {
              this.addRelevantKeys(updatedShortcut.pattern.sequence);
            }
          }
        }
      }
    });
  }

  async toggleEnabled(): Promise<void> {
    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === "shortcutManager");
      if (feature) {
        (feature.config as ShortcutState).isEnabled = !(
          feature.config as ShortcutState
        ).isEnabled;
      }
    });
  }
}
