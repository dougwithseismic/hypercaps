import { dialog } from 'electron';
import { EventEmitter } from 'events';
import {
  KeyboardConfig,
  KeyboardMonitor,
  type KeyboardFrame,
} from '@hypercaps/keyboard-monitor';
import { KeyboardFrameEvent, KeyboardServiceState } from './types';
import { store } from '../../infrastructure/store';
import { RemapperConfig } from '../../features/remapper/types';

const DEFAULT_KEYBOARD_SERVICE_STATE: KeyboardServiceState = {
  isListening: false,
  isLoading: false,
  isStarting: false,
  isServiceEnabled: false,
  features: {
    remapper: {
      isFeatureEnabled: false,
      config: {
        isRemapperEnabled: false,
        remaps: {},
        capsLockBehavior: 'BlockToggle',
      },
    },
  },
};

export class KeyboardService extends EventEmitter {
  private static instance: KeyboardService;
  private keyboardMonitor: KeyboardMonitor | null = null;
  private bufferWindow = 3000; // Default 3 seconds
  private state: KeyboardServiceState = DEFAULT_KEYBOARD_SERVICE_STATE;
  private unsubscribeHandlers: Array<() => void> = [];

  private constructor() {
    super();
    this.setupStoreListeners();
  }

  public static getInstance(): KeyboardService {
    if (!KeyboardService.instance) {
      KeyboardService.instance = new KeyboardService();
    }
    return KeyboardService.instance;
  }

  private setupStoreListeners(): void {
    // Listen for feature config changes
    const unsubscribeConfig = store.events.on(
      'feature:config:changed',
      ({ feature, config }) => {
        if (feature === 'remapper') {
          this.handleConfigChange(config as RemapperConfig);
        }
      }
    );

    // Listen for feature enable/disable
    const unsubscribeEnabled = store.events.on(
      'feature:enabled:changed',
      ({ feature, enabled }) => {
        if (feature === 'remapper') {
          this.handleFeatureToggle(enabled);
        }
      }
    );

    this.unsubscribeHandlers.push(unsubscribeConfig, unsubscribeEnabled);
  }

  private setState(updates: Partial<KeyboardServiceState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('stateChanged', this.state);
  }

  public async getState(): Promise<KeyboardServiceState> {
    return this.state;
  }

  public async initialize(): Promise<void> {
    console.log('[KeyboardService] Initializing...');
    const remapper = store.getFeatureConfig('remapper');

    // Update initial state
    this.setState({
      isServiceEnabled: true,
      features: {
        remapper: {
          isFeatureEnabled: remapper.isFeatureEnabled,
          config: remapper.config,
        },
      },
    });

    // Start if feature is enabled
    if (remapper.isFeatureEnabled) {
      await this.startListening();
    }
  }

  private handleConfigChange(config: RemapperConfig): void {
    console.log('[KeyboardService] Config changed:', config);
    this.restartWithConfig(config).catch((error) => {
      console.error(
        '[KeyboardService] Failed to restart with new config:',
        error
      );
    });
  }

  private handleFeatureToggle(enabled: boolean): void {
    console.log('[KeyboardService] Feature toggled:', enabled);
    if (enabled) {
      this.startListening().catch((error) => {
        console.error('[KeyboardService] Failed to start listening:', error);
      });
    } else {
      this.stopListening().catch((error) => {
        console.error('[KeyboardService] Failed to stop listening:', error);
      });
    }
  }

  private handleKeyboardFrame = (data: KeyboardFrame): void => {
    const keyboardState: KeyboardFrameEvent = {
      frame: data.frame,
      timestamp: data.timestamp,
      event: data.event,
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

    this.emit('frame', keyboardState);
  };

  public async startListening(): Promise<void> {
    console.log('[KeyboardService] startListening() called');

    if (this.keyboardMonitor) {
      console.log('[KeyboardService] Monitor already running');
      return;
    }

    const remapper = store.getFeatureConfig('remapper');
    if (!remapper.isFeatureEnabled) {
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
      const config: KeyboardConfig = {
        isEnabled: remapper.isFeatureEnabled,
        isRemapperEnabled: remapper.config.isRemapperEnabled,
        remaps: remapper.config.remaps,
        capsLockBehavior: remapper.config.capsLockBehavior,
        bufferWindow: this.bufferWindow,
      };

      this.keyboardMonitor = new KeyboardMonitor(
        (eventName: string, data: KeyboardFrame) => {
          if (eventName === 'frame') {
            this.handleKeyboardFrame(data);
          }
        }
      );

      this.keyboardMonitor.setConfig(config);
      this.keyboardMonitor.start();

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
    // Clean up store listeners
    this.unsubscribeHandlers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeHandlers = [];
  }

  private async restartWithConfig(config: RemapperConfig): Promise<void> {
    await this.stopListening();
    await this.startListening();
  }
}

// Export singleton instance
export const keyboardService = KeyboardService.getInstance();
