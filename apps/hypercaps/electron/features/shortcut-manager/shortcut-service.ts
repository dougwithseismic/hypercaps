import { Store } from '../../services/store';

import { KeyboardEvents } from '../hyperkeys/types/keyboard-ipc';
import { AppState } from '../../services/store/types/app-state';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { TriggerMatcher } from './trigger-matcher';
import { InputFrame, Command, CommandMatch } from './types/input-buffer';
import {
  Shortcut,
  ShortcutState,
  TriggerStep,
  TriggerStepType,
} from './types/shortcut';

import { IPCService } from '@hypercaps/ipc';

// Add frame state type
interface FrameState {
  justPressed: string[];
  held: string[];
  justReleased: string[];
  holdDurations: Record<string, number>;
}

// Helper function to map TriggerStepType to Command pattern type
function mapStepType(
  type: TriggerStepType
): 'press' | 'hold' | 'release' | 'combo' {
  switch (type) {
    case 'hold':
      return 'hold';
    case 'combo':
      return 'combo';
    case 'single':
    default:
      return 'press';
  }
}

// Helper function to convert Shortcut to Command
function shortcutToCommand(shortcut: Shortcut): Command {
  return {
    id: shortcut.id,
    cooldown: shortcut.cooldown || 500, // Use shortcut's cooldown or default to 500ms
    pattern: {
      sequence: shortcut.trigger.steps.map((step: TriggerStep) => ({
        type: mapStepType(step.type),
        keys: step.keys,
        holdTime: step.holdTime,
        window: step.window || shortcut.trigger.totalTimeWindow,
        strict: step.strict ?? shortcut.trigger.strict,
      })),
      window: shortcut.trigger.totalTimeWindow || 5000,
      strict: shortcut.trigger.strict,
    },
  };
}

export class ShortcutService {
  private store: Store;
  private ipc: IPCService;
  private matcher: TriggerMatcher;
  private lastExecutions: Map<string, number>;
  private name: string = 'shortcut-manager';

  constructor() {
    this.store = Store.getInstance();
    this.ipc = IPCService.getInstance();
    this.matcher = new TriggerMatcher(32, 5000); // 32 frames, 5 seconds
    this.lastExecutions = new Map();

    // Register the service first
    this.ipc.registerService({
      id: this.name,
      priority: 1,
    });

    this.setupIPCHandlers();
  }

  private setupIPCHandlers(): void {
    // Handle keyboard frame events
    this.ipc.registerHandler('keyboard', 'frame', async (data) => {
      const frameEvent = data as KeyboardEvents['frame'];
      await this.handleFrameEvent(frameEvent);
    });

    // Get shortcut manager config
    this.ipc.registerHandler(this.name, 'get-shortcut-config', async () => {
      const state = (await this.store.getFeature('shortcutManager'))
        ?.config as ShortcutState;
      return state || { isEnabled: false, shortcuts: [] };
    });

    // Get all shortcuts
    this.ipc.registerHandler(this.name, 'get-shortcuts', async () => {
      const state = (await this.store.getFeature('shortcutManager'))
        ?.config as ShortcutState;
      return state?.shortcuts || [];
    });

    // Add a new shortcut
    this.ipc.registerHandler(
      this.name,
      'add-shortcut',
      async (shortcut: Omit<Shortcut, 'id'>) => {
        await this.addShortcut(shortcut);
      }
    );

    // Remove a shortcut
    this.ipc.registerHandler(
      this.name,
      'remove-shortcut',
      async (id: string) => {
        await this.removeShortcut(id);
      }
    );

    // Update a shortcut
    this.ipc.registerHandler(
      this.name,
      'update-shortcut',
      async ({ id, shortcut }: { id: string; shortcut: Partial<Shortcut> }) => {
        await this.updateShortcut(id, shortcut);
      }
    );

    // Toggle a shortcut
    this.ipc.registerHandler(
      this.name,
      'toggle-shortcut',
      async (id: string) => {
        const state = (await this.store.getFeature('shortcutManager'))
          ?.config as ShortcutState;
        const shortcut = state?.shortcuts.find((s) => s.id === id);
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
    const frameData = (data.state || {}) as FrameState;
    const justPressed = Array.isArray(frameData.justPressed)
      ? frameData.justPressed
      : [];
    const heldKeys = Array.isArray(frameData.held) ? frameData.held : [];
    const justReleased = Array.isArray(frameData.justReleased)
      ? frameData.justReleased
      : [];
    const holdDurations = frameData.holdDurations || {};

    // Create a frame from the keyboard event with safe conversions
    const frame: InputFrame = {
      id: data.frame,
      timestamp: data.timestamp,
      justPressed: new Set(justPressed),
      heldKeys: new Set(heldKeys),
      justReleased: new Set(justReleased),
      holdDurations: new Map(Object.entries(holdDurations)),
    };

    console.log('[ShortcutService] Processing frame:', {
      id: frame.id,
      justPressed: Array.from(frame.justPressed),
      held: Array.from(frame.heldKeys),
      justReleased: Array.from(frame.justReleased),
      holdDurations: Object.fromEntries(frame.holdDurations),
      timestamp: frame.timestamp,
    });

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
      const shortcut = state.shortcuts.find((s) => s.id === match.command.id);

      if (!shortcut) {
        console.error(
          `[ShortcutService] Shortcut not found: ${match.command.id}`
        );
        return;
      }

      if (shortcut.action.type === 'launch') {
        exec(shortcut.action.program || '', (error) => {
          if (error) {
            console.error(
              `[ShortcutService] Error executing shortcut: ${error}`
            );
          }
        });
      } else if (shortcut.action.type === 'command') {
        exec(shortcut.action.command || '', (error) => {
          if (error) {
            console.error(
              `[ShortcutService] Error executing command: ${error}`
            );
          }
        });
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
        state.shortcuts = state.shortcuts.filter((s) => s.id !== id);
      }
    });
  }

  async updateShortcut(id: string, update: Partial<Shortcut>): Promise<void> {
    await this.store.update((draft: AppState) => {
      const feature = draft.features.find((f) => f.name === 'shortcutManager');
      if (feature) {
        const state = feature.config as ShortcutState;
        const index = state.shortcuts.findIndex((s) => s.id === id);
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
