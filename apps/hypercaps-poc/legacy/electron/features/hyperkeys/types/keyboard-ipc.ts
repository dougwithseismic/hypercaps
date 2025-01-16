/**
 * Keyboard Service IPC Types
 * Defines the interface for keyboard service communication
 */

import { HyperKeyFeatureConfig } from './hyperkey-feature';
import { KeyEvent, KeyState, ServiceState } from './keyboard-state';

/**
 * Keyboard service commands
 */
export interface KeyboardCommands {
  start: void;
  stop: void;
  restart: {
    config: HyperKeyFeatureConfig;
  };
  getState: void;
}

/**
 * Keyboard service events
 */
export interface KeyboardEvents {
  keyPressed: {
    pressedKeys: string[];
    timestamp: number;
    event?: KeyEvent;
    state?: {
      held: string[];
      holdDurations: Record<string, number>;
    };
  };
  frame: {
    frame: number;
    timestamp: number;
    event: KeyEvent;
    state: KeyState;
  };
  stateChanged: ServiceState & {
    isRunning: boolean;
  };
  configChanged: {
    config: HyperKeyFeatureConfig;
    enabled: boolean;
  };
}

/**
 * Type helper for keyboard service
 */
export type KeyboardService = {
  commands: KeyboardCommands;
  events: KeyboardEvents;
};
