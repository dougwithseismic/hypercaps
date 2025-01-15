import type { KeyboardConfig, KeyboardFrame } from './keyboard';

declare module 'bindings' {
  interface NativeModule {
    KeyboardMonitor: {
      new (callback: (eventName: string, data: KeyboardFrame) => void): {
        start(): void;
        stop(): void;
        setConfig(config: KeyboardConfig): void;
      };
    };
  }

  function bindings(name: string): NativeModule;
  export = bindings;
}
