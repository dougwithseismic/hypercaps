export interface ShortcutTriggerStep {
  type: 'combo' | 'hold';
  keys: string[];
  window: number;
  strict?: boolean;
  holdTime?: number;
}

export interface ShortcutTrigger {
  steps: ShortcutTriggerStep[];
  totalTimeWindow: number;
}

export interface ShortcutAction {
  type: 'launch';
  program: string;
}

export interface Shortcut {
  id: string;
  name: string;
  enabled: boolean;
  cooldown: number;
  trigger: ShortcutTrigger;
  action: ShortcutAction;
}

export interface ShortcutFeatureConfig {
  isEnabled: boolean;
  shortcuts: Shortcut[];
}

export interface ShortcutServiceState {
  isEnabled: boolean;
  isLoading: boolean;
  error?: string;
  lastError?: {
    message: string;
    timestamp: number;
  };
}
