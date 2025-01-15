import bindings from 'bindings';

const addon = bindings('keyboard_monitor');

export interface KeyboardConfig {
  isEnabled: boolean;
  isHyperKeyEnabled: boolean;
  trigger: string;
  modifiers: string[];
  capsLockBehavior?: 'None' | 'DoublePress' | 'BlockToggle';
  bufferWindow?: number;
}

export interface KeyboardFrame {
  frame: number;
  timestamp: number;
  state: {
    justPressed: number[];
    held: number[];
    justReleased: number[];
    holdDurations: Record<string, number>;
  };
}

export type KeyboardEventCallback = (
  eventName: string,
  data: KeyboardFrame
) => void;

interface NativeKeyboardMonitor {
  start(): void;
  stop(): void;
  setConfig(config: KeyboardConfig): void;
}

export class KeyboardMonitor {
  private monitor: NativeKeyboardMonitor;

  constructor(callback: KeyboardEventCallback) {
    this.monitor = new addon.KeyboardMonitor(callback);
  }

  start(): void {
    this.monitor.start();
  }

  stop(): void {
    this.monitor.stop();
  }

  setConfig(config: KeyboardConfig): void {
    this.monitor.setConfig(config);
  }
}

export default KeyboardMonitor;
