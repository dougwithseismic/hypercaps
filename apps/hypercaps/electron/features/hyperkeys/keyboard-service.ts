import { BrowserWindow, dialog } from 'electron';
import { EventEmitter } from 'events';
import { Store } from '@electron/services/store';
import { ipc } from '@electron/services/ipc';
import { HyperKeyFeatureConfig } from './types/hyperkey-feature';
import { KeyboardState, ServiceState } from './types/keyboard-state';
import { IPCSERVICE_NAMES } from '@electron/consts';
import {
  KeyboardMonitor,
  type KeyboardFrame,
} from '@hypercaps/keyboard-monitor';

const SERVICE_ACTIONS = {
  START: 'start',
  STOP: 'stop',
  RESTART: 'restart',
  GET_STATE: 'getState',
  STATE_CHANGED: 'stateChanged',
  FRAME: 'frame',
  CONFIG_CHANGED: 'configChanged',
} as const;

/**
 * Keyboard Service
 *
 * Coordinates between real-time keyboard events and persistent configuration.
 * Uses both MessageQueue (for real-time events) and Store (for configuration).
 *
 * Architecture:
 * - MessageQueue: Handles real-time keyboard events and state updates
 * - Store: Manages feature configuration and persistent settings
 *
 * Data Flow:
 * 1. PowerShell script sends keyboard events
 * 2. Events are queued via MessageQueue for ordered processing
 * 3. Configuration changes are persisted via Store
 * 4. State updates are propagated to renderer via MessageQueue
 */

export class KeyboardService extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private keyboardMonitor: KeyboardMonitor | null = null;
  private store: Store;
  private bufferWindow = 3000; // Default 3 seconds
  private state: ServiceState = {
    isListening: false,
    isLoading: false,
    isStarting: false,
    isHyperKeyEnabled: false,
  };

  constructor() {
    super();
    this.store = Store.getInstance();
    this.setupIPCHandlers();
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupIPCHandlers(): void {
    ipc.registerService({
      id: IPCSERVICE_NAMES.KEYBOARD,
      priority: 1,
    });

    ipc.registerHandler(
      IPCSERVICE_NAMES.KEYBOARD,
      SERVICE_ACTIONS.START,
      async () => {
        await this.startListening();
        return this.getState();
      }
    );

    ipc.registerHandler(
      IPCSERVICE_NAMES.KEYBOARD,
      SERVICE_ACTIONS.STOP,
      async () => {
        await this.stopListening();
        return this.getState();
      }
    );

    ipc.registerHandler(
      IPCSERVICE_NAMES.KEYBOARD,
      SERVICE_ACTIONS.RESTART,
      async (params: { config: HyperKeyFeatureConfig }) => {
        await this.restartWithConfig(params.config);
        return this.getState();
      }
    );

    ipc.registerHandler(
      IPCSERVICE_NAMES.KEYBOARD,
      SERVICE_ACTIONS.GET_STATE,
      async () => {
        return this.getState();
      }
    );
  }

  private setState(updates: Partial<ServiceState>): void {
    this.state = { ...this.state, ...updates };

    // Emit state change
    this.mainWindow?.webContents.send('keyboard-service-state', {
      ...this.state,
      isRunning: this.isRunning(),
    });

    ipc.emit({
      service: IPCSERVICE_NAMES.KEYBOARD,
      event: SERVICE_ACTIONS.STATE_CHANGED,
      data: {
        ...this.state,
        isRunning: this.isRunning(),
      },
    });
  }

  public async getState(): Promise<ServiceState> {
    const hyperKey = await this.store.getFeature(IPCSERVICE_NAMES.HYPERKEY);
    return {
      ...this.state,
      isHyperKeyEnabled: hyperKey?.config.isHyperKeyEnabled ?? false,
    };
  }

  public async init(): Promise<void> {
    await this.store.load();
    const hyperKey = await this.store.getFeature(IPCSERVICE_NAMES.HYPERKEY);
    console.log('[KeyboardService] HyperKey feature state:', hyperKey);

    if (!hyperKey) {
      this.setState({
        error: 'HyperKey feature not found',
        lastError: {
          message: 'HyperKey feature not found',
          timestamp: Date.now(),
        },
      });
      throw new Error('HyperKey feature not found');
    }

    // Send initial state to renderer
    this.mainWindow?.webContents.send('hyperkey-state', {
      ...hyperKey.config,
      enabled: hyperKey.isFeatureEnabled,
    });

    // Auto-start if feature is enabled
    if (hyperKey.isFeatureEnabled) {
      await this.startListening();
    }
  }

  private handleKeyboardFrame = (data: KeyboardFrame): void => {
    // Send frame state directly to renderer and emit IPC event
    const keyboardState: KeyboardState = {
      frame: data.frame,
      timestamp: data.timestamp,
      event: {
        type: 'keydown',
        key: String(data.state.justPressed[0] || ''), // Use first pressed key if available
      },
      state: {
        justPressed: data.state.justPressed.map(String),
        held: data.state.held.map(String),
        justReleased: data.state.justReleased.map(String),
        holdDurations: Object.entries(data.state.holdDurations).reduce(
          (acc, [key, value]) => ({ ...acc, [String(key)]: value }),
          {}
        ),
      },
    };

    this.mainWindow?.webContents.send('keyboard-frame', keyboardState);
    ipc.emit({
      service: IPCSERVICE_NAMES.KEYBOARD,
      event: SERVICE_ACTIONS.FRAME,
      data: keyboardState,
    });
  };

  public async startListening(): Promise<void> {
    console.log('[KeyboardService] startListening() called');

    if (this.keyboardMonitor) {
      console.log('[KeyboardService] Monitor already running');
      return;
    }

    const hyperKey = await this.store.getFeature(IPCSERVICE_NAMES.HYPERKEY);
    if (!hyperKey?.isFeatureEnabled) {
      console.log('[KeyboardService] Feature is disabled, not starting');
      return;
    }

    this.setState({
      isLoading: true,
      isStarting: true,
      error: undefined,
      lastError: undefined,
      isListening: false,
    });

    try {
      const config = {
        isEnabled: hyperKey.isFeatureEnabled,
        isHyperKeyEnabled: hyperKey.config.isHyperKeyEnabled,
        trigger: hyperKey.config.trigger,
        modifiers: hyperKey.config.modifiers || [],
        capsLockBehavior: hyperKey.config.capsLockBehavior || 'BlockToggle',
        bufferWindow: this.bufferWindow,
      };

      // Create and configure keyboard monitor
      this.keyboardMonitor = new KeyboardMonitor(
        (eventName: string, data: KeyboardFrame) => {
          if (eventName === 'frame') {
            this.handleKeyboardFrame(data);
          }
        }
      );

      // Start monitoring
      this.keyboardMonitor.setConfig(config);
      this.keyboardMonitor.start();

      // Update store on successful start
      await this.store.update((draft) => {
        const feature = draft.features.find(
          (f) => f.name === IPCSERVICE_NAMES.HYPERKEY
        );
        if (feature) {
          feature.isFeatureEnabled = true;
        }
      });

      this.setState({
        isListening: true,
        isLoading: false,
        isStarting: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during startup';
      this.setState({
        isStarting: false,
        error: errorMessage,
        lastError: {
          message: errorMessage,
          timestamp: Date.now(),
        },
      });
      dialog.showErrorBox(
        'Keyboard Monitor Error',
        `Failed to start keyboard monitor: ${errorMessage}`
      );
    }
  }

  public async stopListening(): Promise<void> {
    console.log('[KeyboardService] stopListening() called');

    if (this.keyboardMonitor) {
      this.keyboardMonitor.stop();
      this.keyboardMonitor = null;
    }

    this.setState({
      isListening: false,
      isLoading: false,
      error: undefined,
    });

    console.log('[KeyboardService] Service stopped');
  }

  public isRunning(): boolean {
    return this.keyboardMonitor !== null;
  }

  public dispose(): void {
    this.stopListening();
    this.mainWindow = null;
  }

  public async restartWithConfig(config: HyperKeyFeatureConfig): Promise<void> {
    await this.store.update((draft) => {
      const feature = draft.features.find(
        (f) => f.name === IPCSERVICE_NAMES.HYPERKEY
      );
      if (feature) {
        feature.config = config;
      }
    });

    // Emit config change event
    this.mainWindow?.webContents.send('ipc:event', {
      service: IPCSERVICE_NAMES.HYPERKEY,
      event: SERVICE_ACTIONS.CONFIG_CHANGED,
      data: config,
    });

    await this.stopListening();
    await this.startListening();
  }
}
