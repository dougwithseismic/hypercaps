/**
 * Keyboard Service IPC Types
 * Defines the interface for keyboard service communication
 */

import { HyperKeyFeatureConfig } from "./hyperkey-feature";

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
  };
  stateChanged: {
    isListening: boolean;
    isLoading: boolean;
    isStarting: boolean;
    error?: string;
    lastError?: {
      message: string;
      timestamp: number;
    };
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
