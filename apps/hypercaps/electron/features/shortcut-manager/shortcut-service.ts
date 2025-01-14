import { EventEmitter } from "events";
import { BrowserWindow } from "electron";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { Store } from "../../services/store";
import { MessageQueue } from "../../services/queue";
import { IPCService } from "../../services/ipc";
import type { Shortcut, ShortcutState } from "./types/shortcut";
import type { HyperKeyFeatureConfig } from "../../services/types";

const ipc = IPCService.getInstance();

export class ShortcutService extends EventEmitter {
  private store: Store;
  private queue: MessageQueue;
  private state: ShortcutState = {
    shortcuts: [],
    isEnabled: true,
  };

  constructor() {
    super();
    this.store = Store.getInstance();
    this.queue = MessageQueue.getInstance();
    this.setupQueueHandlers();
    this.setupIPCHandlers();

    console.log("[ShortcutService] Initialized", ipc);
  }

  private setupQueueHandlers(): void {
    this.queue.registerHandler("shortcut:execute", async (event) => {
      console.log("[ShortcutService] Executing shortcut:", event);
      await this.executeShortcut(event as unknown as Shortcut);
    });
  }

  private setupIPCHandlers(): void {
    ipc.registerService({
      id: "shortcuts",
      priority: 2,
    });

    // Listen for keyboard events
    ipc.registerHandler(
      "keyboard",
      "keyPressed",
      async (data: { pressedKeys: string[] }) => {
        console.log("[ShortcutService] Handling key pressed event:", data);
        await this.handleKeyboardEvent(data);
      }
    );

    ipc.registerHandler("shortcuts", "addShortcut", async ({ shortcut }) => {
      console.log("[ShortcutService] Adding shortcut:", shortcut);
      const newShortcut: Shortcut = {
        ...shortcut,
        id: uuidv4(),
      };
      await this.store.update((draft) => {
        const feature = draft.features.find(
          (f) => f.name === "shortcutManager"
        );
        if (feature) {
          (feature.config as ShortcutState).shortcuts.push(newShortcut);
        }
      });
      return this.getState();
    });

    ipc.registerHandler("shortcuts", "removeShortcut", async ({ id }) => {
      await this.store.update((draft) => {
        const feature = draft.features.find(
          (f) => f.name === "shortcutManager"
        );
        if (feature) {
          const state = feature.config as ShortcutState;
          state.shortcuts = state.shortcuts.filter((s) => s.id !== id);
        }
      });
      return this.getState();
    });

    ipc.registerHandler(
      "shortcuts",
      "updateShortcut",
      async ({ id, shortcut }) => {
        await this.store.update((draft) => {
          const feature = draft.features.find(
            (f) => f.name === "shortcutManager"
          );
          if (feature) {
            const state = feature.config as ShortcutState;
            const index = state.shortcuts.findIndex((s) => s.id === id);
            if (index !== -1) {
              state.shortcuts[index] = {
                ...state.shortcuts[index],
                ...shortcut,
              };
            }
          }
        });
        return this.getState();
      }
    );

    ipc.registerHandler("shortcuts", "toggleEnabled", async ({ enabled }) => {
      console.log("[ShortcutService] Toggling enabled:", enabled);
      await this.store.update((draft) => {
        const feature = draft.features.find(
          (f) => f.name === "shortcutManager"
        );
        if (feature) {
          (feature.config as ShortcutState).isEnabled = enabled;
        }
      });
      return this.getState();
    });

    ipc.registerHandler("shortcuts", "getState", async () => {
      return this.getState();
    });
  }

  public async handleKeyboardEvent(data: {
    pressedKeys: string[];
  }): Promise<void> {
    const state = await this.getState();

    if (!state.isEnabled) {
      console.log("[ShortcutService] Service disabled, ignoring keys");
      return;
    }

    console.log("[ShortcutService] Pressed keys:", data.pressedKeys);

    // Get HyperKey config
    const hyperKeyFeature = await this.store.getFeature("hyperKey");
    if (!hyperKeyFeature?.config) {
      console.log("[ShortcutService] No HyperKey config found");
      return;
    }

    const hyperKeyConfig = hyperKeyFeature.config as HyperKeyFeatureConfig;
    if (!hyperKeyConfig.isHyperKeyEnabled) {
      console.log("[ShortcutService] HyperKey is disabled");
      return;
    }

    console.log("[ShortcutService] HyperKey config:", hyperKeyConfig);

    // Check if HyperKey trigger is pressed
    if (!data.pressedKeys.includes(hyperKeyConfig.trigger)) {
      console.log("[ShortcutService] HyperKey trigger not pressed");
      return;
    }

    // Check if all modifiers are pressed
    const allModifiersPressed = hyperKeyConfig.modifiers.every((modifier) =>
      data.pressedKeys.includes(modifier)
    );
    if (!allModifiersPressed) {
      console.log("[ShortcutService] Not all modifiers are pressed");
      return;
    }

    console.log("[ShortcutService] HyperKey combination active!");

    // Check each shortcut
    for (const shortcut of state.shortcuts) {
      if (!shortcut.enabled) continue;

      // Check if trigger key is pressed
      if (data.pressedKeys.includes(shortcut.triggerKey)) {
        console.log("[ShortcutService] Executing shortcut:", shortcut);
        await this.executeShortcut(shortcut);
      }
    }
  }

  private async executeShortcut(shortcut: Shortcut): Promise<void> {
    try {
      if (shortcut.action.type === "launch") {
        console.log(
          "[ShortcutService] Launching program:",
          shortcut.action.program
        );
        spawn(shortcut.action.program, [], { detached: true });
      }

      ipc.emit({
        service: "shortcuts",
        event: "shortcutTriggered",
        data: {
          shortcut,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error("[ShortcutService] Error executing shortcut:", error);
    }
  }

  private getState(): ShortcutState {
    const feature = this.store
      .getState()
      .features.find((f) => f.name === "shortcutManager");
    return (feature?.config as ShortcutState) || this.state;
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize the feature in the store if it doesn't exist
      await this.store.update((draft) => {
        const feature = draft.features.find(
          (f) => f.name === "shortcutManager"
        );
        if (!feature) {
          console.log("[ShortcutService] Creating shortcut manager feature");
          draft.features.push({
            name: "shortcutManager",
            isFeatureEnabled: true,
            enableFeatureOnStartup: true,
            config: {
              shortcuts: [],
              isEnabled: true,
            },
          });
        }
      });

      // Add test shortcut if none exist
      const state = this.getState();
      if (!state.shortcuts || state.shortcuts.length === 0) {
        console.log("[ShortcutService] Adding test Notepad shortcut");
        await this.store.update((draft) => {
          const feature = draft.features.find(
            (f) => f.name === "shortcutManager"
          );
          if (feature) {
            (feature.config as ShortcutState).shortcuts = [
              {
                id: uuidv4(),
                name: "Test Notepad",
                triggerKey: "N",
                action: {
                  type: "launch",
                  program: "notepad.exe",
                },
                enabled: true,
              },
            ];
          }
        });
      }

      console.log("[ShortcutService] Initialized with state:", this.getState());
    } catch (error) {
      console.error("[ShortcutService] Error initializing:", error);
    }
  }
}
