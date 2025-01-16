import { Store } from '../../services/store';
import { KeyboardEvents } from '../hyperkeys/types/keyboard-ipc';
import { AppState } from '../../services/store/types/app-state';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { IPCService } from '@hypercaps/ipc';
import { KeyboardEventMatcher } from '../../../../_main/features/shortcuts/keyboard-event-matcher';
import {
  Command,
  CommandMatch,
  KeyboardFrame,
  Shortcut,
  ShortcutState,
  TriggerStep,
} from '../../../../_main/features/shortcuts/types';
import { IPCSERVICE_NAMES } from '@electron/consts';

// Helper function to convert Shortcut to Command
function shortcutToCommand(shortcut: Shortcut): Command {
  return {
    id: shortcut.id,
    pattern: {
      steps: shortcut.trigger.steps.map((step) => ({
        type: step.type as TriggerStep['type'],
        keys: step.keys,
        conditions: {
          holdTime: step.holdTime || step.conditions?.holdTime,
          window: step.window || step.conditions?.window,
          strict: step.strict || step.conditions?.strict,
        },
      })),
      window: shortcut.trigger.window,
      totalTimeWindow: shortcut.trigger.totalTimeWindow,
      strict: shortcut.trigger.strict,
    },
    cooldown: shortcut.cooldown || 500, // Default cooldown if not specified
  };
}

export class ShortcutService {
  private store: Store;
  private ipc: IPCService;
  private matcher: KeyboardEventMatcher;
  private lastExecutions: Map<string, number>;
  constructor() {
    this.store = Store.getInstance();
    this.ipc = IPCService.getInstance();
    this.matcher = new KeyboardEventMatcher(32, 5000); // 32 frames, 5 seconds
    this.lastExecutions = new Map();

    this.ipc.registerService({
      id: IPCSERVICE_NAMES.SHORTCUT_MANAGER,
      priority: 1,
    });

    this.setupIPCHandlers();
  }

  private setupIPCHandlers(): void {
    // Handle keyboard frame events
    this.ipc.registerHandler(
      IPCSERVICE_NAMES.KEYBOARD,
      'frame',
      async (data) => {
        const frameEvent = data as KeyboardEvents['frame'];
        await this.handleFrameEvent(frameEvent);
      }
    );

    // Get shortcut manager config
    this.ipc.registerHandler(
      IPCSERVICE_NAMES.SHORTCUT_MANAGER,
      'get-shortcut-config',
      async () => {
        const state = (await this.store.getFeature('shortcutManager'))
          ?.config as ShortcutState;
        return state || { isEnabled: false, shortcuts: [] };
      }
    );

    // Get all shortcuts
    this.ipc.registerHandler(
      IPCSERVICE_NAMES.SHORTCUT_MANAGER,
      'get-shortcuts',
      async () => {
        const state = (await this.store.getFeature('shortcutManager'))
          ?.config as ShortcutState;
        return state?.shortcuts || [];
      }
    );

    // Add a new shortcut
    this.ipc.registerHandler(
      IPCSERVICE_NAMES.SHORTCUT_MANAGER,
      'add-shortcut',
      async (shortcut: Omit<Shortcut, 'id'>) => {
        await this.addShortcut(shortcut);
      }
    );

    // Remove a shortcut
    this.ipc.registerHandler(
      IPCSERVICE_NAMES.SHORTCUT_MANAGER,
      'remove-shortcut',
      async (id: string) => {
        await this.removeShortcut(id);
      }
    );

    // Update a shortcut
    this.ipc.registerHandler(
      IPCSERVICE_NAMES.SHORTCUT_MANAGER,
      'update-shortcut',
      async ({ id, shortcut }: { id: string; shortcut: Partial<Shortcut> }) => {
        await this.updateShortcut(id, shortcut);
      }
    );

    // Toggle a shortcut
    this.ipc.registerHandler(
      IPCSERVICE_NAMES.SHORTCUT_MANAGER,
      'toggle-shortcut',
      async (id: string) => {
        const state = (await this.store.getFeature('shortcutManager'))
          ?.config as ShortcutState;
        const shortcut = state?.shortcuts.find((s: Shortcut) => s.id === id);
        if (shortcut) {
          await this.updateShortcut(id, { enabled: !shortcut.enabled });
        }
      }
    );
  }

  async initialize(): Promise<void> {
    console.log('[ShortcutService] Initializing...');

    try {
      // Get current state
      const feature = await this.store.getFeature('shortcutManager');

      // Initialize feature in store if it doesn't exist
      if (!feature) {
        await this.store.update((draft: AppState) => {
          draft.features.push({
            name: 'shortcutManager',
            isFeatureEnabled: true,
            enableFeatureOnStartup: true,
            config: {
              isEnabled: true,
              shortcuts: [],
            },
          });
        });
      }

      console.log('[ShortcutService] Initialized successfully');
    } catch (error) {
      console.error('[ShortcutService] Initialization error:', error);
    }
  }

  private async handleFrameEvent(data: KeyboardEvents['frame']): Promise<void> {
    const state = (await this.store.getFeature('shortcutManager'))
      ?.config as ShortcutState;
    if (!state?.isEnabled) return;

    // Extract frame data from the state property
    const frameData = (data.state || {}) as {
      justPressed: string[];
      held: string[];
      justReleased: string[];
      holdDurations: Record<string, number>;
    };

    // Create a frame from the keyboard event
    const frame: KeyboardFrame = {
      id: data.frame,
      timestamp: data.timestamp,
      justPressed: new Set(frameData.justPressed || []),
      heldKeys: new Set(frameData.held || []),
      justReleased: new Set(frameData.justReleased || []),
      holdDurations: new Map(Object.entries(frameData.holdDurations || {})),
    };

    // Add frame to matcher
    this.matcher.addFrame(frame);

    // Find and execute matches
    const enabledShortcuts = state.shortcuts
      .filter((s: Shortcut) => s.enabled)
      .map(shortcutToCommand);

    const matches = this.matcher.findMatches(enabledShortcuts);

    // Execute matched shortcuts
    for (const match of matches) {
      await this.executeShortcut(match);
    }
  }

  private async executeShortcut(match: CommandMatch): Promise<void> {
    const now = Date.now();
    const lastExecution = this.lastExecutions.get(match.command.id) || 0;
    const cooldown = match.command.cooldown || 500;

    if (now - lastExecution < cooldown) {
      console.log(
        `[ShortcutService] Skipping execution of ${match.command.id} - in cooldown (${cooldown}ms)`
      );
      return;
    }

    console.log(`[ShortcutService] Executing shortcut: ${match.command.id}`);
    this.lastExecutions.set(match.command.id, now);

    try {
      // Find the original shortcut from the store
      const state = (await this.store.getFeature('shortcutManager'))
        ?.config as ShortcutState;
      const shortcut = state.shortcuts.find(
        (s: Shortcut) => s.id === match.command.id
      );

      if (!shortcut) {
        console.error(
          `[ShortcutService] Shortcut not found: ${match.command.id}`
        );
        return;
      }

      // Use spawn instead of exec for better process handling
      const { spawn } = require('child_process');
      const isProduction = process.env.NODE_ENV === 'production';

      if (shortcut.action.type === 'launch') {
        console.log(
          `[ShortcutService] Launching program: ${shortcut.action.program}`
        );
        const program = shortcut.action.program || '';

        // In production, we need to use cmd.exe to launch programs
        if (isProduction) {
          const child = spawn('cmd.exe', ['/c', 'start', '', program], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });

          child.on('error', (error: Error) => {
            console.error(`[ShortcutService] Launch error: ${error.message}`);
          });

          child.unref();
        } else {
          // In development, we can use exec
          exec(program, (error) => {
            if (error) {
              console.error(
                `[ShortcutService] Error executing program: ${error}`
              );
            }
          });
        }
      } else if (shortcut.action.type === 'command') {
        console.log(
          `[ShortcutService] Running command: ${shortcut.action.command}`
        );
        const command = shortcut.action.command || '';

        // In production, we need to use cmd.exe to run commands
        if (isProduction) {
          const child = spawn('cmd.exe', ['/c', command], {
            shell: true,
            detached: true,
            stdio: 'ignore',
          });

          child.on('error', (error: Error) => {
            console.error(`[ShortcutService] Command error: ${error.message}`);
          });

          child.unref();
        } else {
          // In development, we can use exec
          exec(command, (error) => {
            if (error) {
              console.error(
                `[ShortcutService] Error executing command: ${error}`
              );
            }
          });
        }
      }

      // Clear the matcher state after successful execution
      this.matcher.clearFramesUpTo(match.endTime);
    } catch (error) {
      console.error('[ShortcutService] Error executing shortcut:', error);
    }
  }

  async addShortcut(shortcut: Omit<Shortcut, 'id'>): Promise<void> {
    const newShortcut: Shortcut = {
      ...shortcut,
      id: uuidv4(),
    };

    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === 'shortcutManager');
      if (feature) {
        (feature.config as ShortcutState).shortcuts.push(newShortcut);
      }
    });
  }

  async removeShortcut(id: string): Promise<void> {
    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === 'shortcutManager');
      if (feature) {
        const state = feature.config as ShortcutState;
        state.shortcuts = state.shortcuts.filter((s: Shortcut) => s.id !== id);
      }
    });
  }

  async updateShortcut(id: string, update: Partial<Shortcut>): Promise<void> {
    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === 'shortcutManager');
      if (feature) {
        const state = feature.config as ShortcutState;
        const index = state.shortcuts.findIndex((s: Shortcut) => s.id === id);
        if (index !== -1) {
          state.shortcuts[index] = { ...state.shortcuts[index], ...update };
        }
      }
    });
  }

  async toggleEnabled(): Promise<void> {
    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === 'shortcutManager');
      if (feature) {
        (feature.config as ShortcutState).isEnabled = !(
          feature.config as ShortcutState
        ).isEnabled;
      }
    });
  }
}
