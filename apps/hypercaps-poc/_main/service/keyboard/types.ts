import { KeyboardFrame } from '@hypercaps/keyboard-monitor';
import { RemapperFeature } from '../../features/remapper/types';

export interface ErrorState {
  message: string;
  timestamp: number;
  code?: string;
}

export interface FrameHistoryOptions {
  maxSize: number;
  retentionMs: number;
}

export interface KeyboardServiceState {
  isListening: boolean;
  isLoading: boolean;
  isStarting: boolean;
  isServiceEnabled: boolean;
  features: {
    remapper: RemapperFeature;
  };
  currentFrame?: KeyboardFrameEvent;
  frameHistory: KeyboardFrameEvent[];
  historyOptions: FrameHistoryOptions;
  error?: string;
  lastError?: ErrorState;
}

export interface KeyboardFrameState {
  justPressed: number[];
  held: number[];
  justReleased: number[];
  holdDurations: Record<number, number>;
}

export interface KeyboardFrameEvent extends Omit<KeyboardFrame, 'state'> {
  id: string;
  processed: boolean;
  validationErrors?: string[];
  state: KeyboardFrameState;
}

export interface StateChangeEvent {
  previous: Partial<KeyboardServiceState>;
  current: Partial<KeyboardServiceState>;
  timestamp: number;
}

export interface ConfigChangeEvent {
  feature: string;
  previous: unknown;
  current: unknown;
  timestamp: number;
}

export type KeyboardEventMap = {
  'keyboard:frame': KeyboardFrameEvent;
  'keyboard:error': ErrorState;
  'keyboard:state': StateChangeEvent;
  'keyboard:config': ConfigChangeEvent;
  'keyboard:frameHistory': KeyboardFrameEvent[];
};
