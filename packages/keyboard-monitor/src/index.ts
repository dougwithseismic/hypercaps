import bindings from 'bindings';
import type { KeyboardConfig, KeyboardFrame } from './types/keyboard';

const addon = bindings('keyboard_monitor');

export * from './types/keyboard';

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
