import { KeyboardFrame } from '@hypercaps/keyboard-monitor';
import { RemapperFeature } from '../../features/remapper/types';

export interface KeyboardServiceState {
  isListening: boolean;
  isLoading: boolean;
  isStarting: boolean;
  isServiceEnabled: boolean;
  features: {
    remapper: RemapperFeature;
  };
  error?: string;
  lastError?: {
    message: string;
    timestamp: number;
  };
}

export type KeyboardFrameEvent = KeyboardFrame & {};
