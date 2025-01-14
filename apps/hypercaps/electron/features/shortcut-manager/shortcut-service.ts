import { Store } from "../../services/store";
import { IPCService } from "../../services/ipc";
import { Shortcut, ShortcutState } from "./types/shortcut";
import { TriggerMatcher } from "./trigger-matcher";
import { KeyBuffer } from "./types/key-buffer";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { AppState } from "../../services/store/types/app-state";
import { KeyboardEvents } from "../hyperkeys/types/keyboard-ipc";

export class ShortcutService {
  private store: Store;
  private ipc: IPCService;
  private triggerMatchers: Map<string, TriggerMatcher> = new Map();
  private activeBuffers: Map<string, KeyBuffer> = new Map();
  private relevantKeys: Set<string> = new Set();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 16; // ~60fps, much more responsive

  constructor() {
    this.store = Store.getInstance();
    this.ipc = IPCService.getInstance();
    this.setupIPCHandlers();
  }

  private setupIPCHandlers(): void {
    // Listen for keyboard events
    this.ipc.registerHandler("keyboard", "keyPressed", async (data) => {
      const keyboardEvent = data as KeyboardEvents["keyPressed"];
      await this.handleKeyboardEvent(keyboardEvent);
    });
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      this.cleanupExpiredBuffers(now);

      // If no buffers left, clear the interval
      if (this.activeBuffers.size === 0 && this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupExpiredBuffers(timestamp: number): void {
    let hasExpired = false;
    for (const [key, buffer] of this.activeBuffers.entries()) {
      if (timestamp - buffer.startTime > buffer.bufferWindow) {
        console.log(`[ShortcutService] Buffer expired for key ${key}`);
        this.activeBuffers.delete(key);
        hasExpired = true;
      }
    }

    // If we have no buffers left, stop the cleanup timer
    if (hasExpired && this.activeBuffers.size === 0 && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private getBufferConfigForKey(key: string): {
    window: number;
    tapCount: number;
    tapWindow: number;
  } {
    // Find the most demanding config for this key across all shortcuts
    let maxWindow = 200; // Default fallback
    let maxTapCount = 1; // Default fallback
    let maxTapWindow = 100; // Default fallback

    for (const [_, matcher] of this.triggerMatchers) {
      const step = matcher.getStepForKey(key);
      if (step && step.type === "single") {
        const config = matcher.getStepBuffer(step);
        maxWindow = Math.max(maxWindow, config.window || 200);
        maxTapCount = Math.max(maxTapCount, config.tapCount || 1);
        maxTapWindow = Math.max(maxTapWindow, config.tapWindow || 100);
      }
    }

    return {
      window: maxWindow,
      tapCount: maxTapCount,
      tapWindow: maxTapWindow,
    };
  }

  private createOrUpdateBuffer(
    key: string,
    pressedKeys: Set<string>,
    timestamp: number
  ): void {
    // Skip processing if no keys are pressed
    if (pressedKeys.size === 0) return;

    let buffer = this.activeBuffers.get(key);

    // Check for interference - for single key steps, any other key is interference
    // unless it's part of the current combo step
    const interferingKeys = Array.from(pressedKeys).filter((pressedKey) => {
      // Skip the key we're buffering
      if (pressedKey === key) return false;

      // For each matcher that uses this key
      for (const [_, matcher] of this.triggerMatchers) {
        const step = matcher.getStepForKey(key);
        if (!step) continue;

        // If this is a single key step, any other key is interference
        if (step.type === "single") {
          return true;
        }

        // If this is a combo step, other keys in the combo are not interference
        if (step.type === "combo" && step.keys.includes(pressedKey)) {
          return false;
        }
      }

      // If we get here, the key isn't part of any relevant step
      return true;
    });

    const hasInterference = interferingKeys.length > 0;

    // Always clear the buffer if there's interference, even for existing buffers
    if (hasInterference) {
      if (buffer) {
        console.log(
          `[ShortcutService] Clearing buffer for ${key} due to interference from:`,
          interferingKeys
        );
        this.activeBuffers.delete(key);
        return; // Exit early since we've cleared the buffer
      }
      console.log(
        `[ShortcutService] Not creating buffer for ${key} due to interference from:`,
        interferingKeys
      );
      return; // Exit early to prevent buffer creation
    }

    if (!buffer) {
      const config = this.getBufferConfigForKey(key);
      buffer = {
        key,
        startTime: timestamp,
        lastTapTime: timestamp,
        tapCount: 1,
        requiredTaps: config.tapCount,
        tapWindow: config.tapWindow,
        bufferWindow: config.window,
      };
      this.activeBuffers.set(key, buffer);
      this.startCleanupTimer();
      console.log(
        `[ShortcutService] Created new buffer for key ${key} at ${timestamp}, config:`,
        config
      );
    } else {
      // Update existing buffer
      const timeSinceLastTap = timestamp - buffer.lastTapTime;
      const isKeyRepeat = timeSinceLastTap < 20;

      if (!isKeyRepeat && timeSinceLastTap <= buffer.tapWindow) {
        buffer.tapCount++;
        buffer.lastTapTime = timestamp;
        buffer.startTime = timestamp;
        console.log(
          `[ShortcutService] Key ${key} tapped, count: ${buffer.tapCount}/${buffer.requiredTaps} at ${timestamp}`
        );
      } else if (isKeyRepeat) {
        console.log(
          `[ShortcutService] Ignoring key repeat for ${key} (${timeSinceLastTap}ms)`
        );
      } else if (timeSinceLastTap > buffer.tapWindow) {
        buffer.tapCount = 1;
        buffer.lastTapTime = timestamp;
        buffer.startTime = timestamp;
        console.log(
          `[ShortcutService] Key ${key} tap window expired, resetting count at ${timestamp}`
        );
      }
    }
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

      // Initialize trigger matchers for existing shortcuts
      const state = (await this.store.getFeature("shortcutManager"))
        ?.config as ShortcutState;

      // Add test shortcut if none exist
      if (!state?.shortcuts || state.shortcuts.length === 0) {
        const testShortcut: Shortcut = {
          id: uuidv4(),
          name: "Test Complex Notepad",
          enabled: true,
          trigger: {
            steps: [
              {
                type: "combo",
                keys: ["LShiftKey", "LControlKey", "N"],
                timeWindow: 200,
              },
              {
                type: "single",
                keys: ["H"],
                buffer: {
                  window: 800,
                  tapCount: 2,
                  tapWindow: 250,
                },
              },
            ],
            totalTimeWindow: 2000,
          },
          action: {
            type: "launch",
            program: "notepad.exe",
          },
        };

        await this.store.update((draft: AppState) => {
          const feature = draft.features.find(
            (f) => f.name === "shortcutManager"
          );
          if (feature) {
            (feature.config as ShortcutState).shortcuts = [testShortcut];
          }
        });

        // Initialize trigger matcher for test shortcut
        const matcher = new TriggerMatcher(testShortcut.trigger);
        this.triggerMatchers.set(testShortcut.id, matcher);
        matcher.getRequiredKeys().forEach((key) => this.relevantKeys.add(key));
        console.log("[ShortcutService] Added test shortcut:", testShortcut);
      }

      // Initialize existing shortcuts
      if (state?.shortcuts) {
        state.shortcuts.forEach((shortcut: Shortcut) => {
          if (shortcut.enabled) {
            const matcher = new TriggerMatcher(shortcut.trigger);
            this.triggerMatchers.set(shortcut.id, matcher);
            matcher
              .getRequiredKeys()
              .forEach((key) => this.relevantKeys.add(key));
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

    // Skip processing if no keys are pressed
    if (pressedKeys.size === 0) return;

    // Check for interference with existing buffers
    for (const pressedKey of pressedKeys) {
      // Skip if it's a key we're tracking
      if (this.relevantKeys.has(pressedKey)) continue;

      // If we get here, it's an interfering key - clear all single-key buffers
      for (const [bufferKey, _] of this.activeBuffers) {
        console.log(
          `[ShortcutService] Clearing buffer for ${bufferKey} due to interference from non-tracked key:`,
          pressedKey
        );
        this.activeBuffers.delete(bufferKey);
      }
      break; // We only need to do this once if we find any interfering key
    }

    // Clean up expired buffers
    this.cleanupExpiredBuffers(data.timestamp);

    // Create or update buffers for relevant pressed keys
    for (const key of pressedKeys) {
      if (this.relevantKeys.has(key)) {
        this.createOrUpdateBuffer(key, pressedKeys, data.timestamp);
      }
    }

    // Track which buffers were used to trigger shortcuts
    const usedBuffers = new Set<string>();

    // Check each active trigger matcher
    for (const [shortcutId, matcher] of this.triggerMatchers) {
      const shortcut = state.shortcuts.find(
        (s: Shortcut) => s.id === shortcutId
      );
      if (!shortcut || !shortcut.enabled) continue;

      const isTriggered = matcher.updateState(
        pressedKeys,
        this.activeBuffers,
        data.timestamp
      );
      if (isTriggered) {
        console.log(`[ShortcutService] Shortcut triggered: ${shortcut.name}`);
        await this.executeShortcut(shortcut);

        // Mark buffers used by this shortcut as used
        matcher.getRequiredKeys().forEach((key) => usedBuffers.add(key));
      } else {
        const progress = matcher.getCurrentProgress();
        if (progress.completedSteps.some((step) => step)) {
          console.log(`[ShortcutService] Shortcut progress:`, {
            name: shortcut.name,
            currentStep: progress.currentStep + 1,
            totalSteps: progress.totalSteps,
            completedSteps: progress.completedSteps,
          });
        }
      }
    }

    // Clear any buffers that were used to trigger shortcuts
    usedBuffers.forEach((key) => {
      if (this.activeBuffers.has(key)) {
        console.log(`[ShortcutService] Clearing used buffer for key ${key}`);
        this.activeBuffers.delete(key);
      }
    });
  }

  private async executeShortcut(shortcut: Shortcut): Promise<void> {
    try {
      if (shortcut.action.type === "launch" && shortcut.action.program) {
        exec(shortcut.action.program, (error) => {
          if (error) {
            console.error(
              `[ShortcutService] Error executing shortcut: ${error}`
            );
          }
        });
      } else if (
        shortcut.action.type === "command" &&
        shortcut.action.command
      ) {
        exec(shortcut.action.command, (error) => {
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

  async addShortcut(shortcut: Omit<Shortcut, "id">): Promise<void> {
    const newShortcut: Shortcut = {
      ...shortcut,
      id: uuidv4(),
    };

    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === "shortcutManager");
      if (feature) {
        (feature.config as ShortcutState).shortcuts.push(newShortcut);
      }
    });

    if (newShortcut.enabled) {
      const matcher = new TriggerMatcher(newShortcut.trigger);
      this.triggerMatchers.set(newShortcut.id, matcher);
      matcher.getRequiredKeys().forEach((key) => this.relevantKeys.add(key));
    }
  }

  async removeShortcut(id: string): Promise<void> {
    const matcher = this.triggerMatchers.get(id);
    if (matcher) {
      // Remove keys from relevantKeys if no other shortcuts use them
      matcher.getRequiredKeys().forEach((key) => {
        let isUsedElsewhere = false;
        for (const [otherId, otherMatcher] of this.triggerMatchers) {
          if (otherId !== id && otherMatcher.getRequiredKeys().has(key)) {
            isUsedElsewhere = true;
            break;
          }
        }
        if (!isUsedElsewhere) {
          this.relevantKeys.delete(key);
        }
      });
    }

    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === "shortcutManager");
      if (feature) {
        const state = feature.config as ShortcutState;
        state.shortcuts = state.shortcuts.filter((s: Shortcut) => s.id !== id);
      }
    });

    this.triggerMatchers.delete(id);
  }

  async updateShortcut(id: string, shortcut: Partial<Shortcut>): Promise<void> {
    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === "shortcutManager");
      if (feature) {
        const state = feature.config as ShortcutState;
        const index = state.shortcuts.findIndex((s: Shortcut) => s.id === id);
        if (index !== -1) {
          state.shortcuts[index] = { ...state.shortcuts[index], ...shortcut };

          // Update trigger matcher if needed
          if (shortcut.trigger || shortcut.enabled !== undefined) {
            const updatedShortcut = state.shortcuts[index];
            if (updatedShortcut.enabled) {
              const matcher = new TriggerMatcher(updatedShortcut.trigger);
              this.triggerMatchers.set(id, matcher);
              matcher
                .getRequiredKeys()
                .forEach((key) => this.relevantKeys.add(key));
            } else {
              this.triggerMatchers.delete(id);
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
