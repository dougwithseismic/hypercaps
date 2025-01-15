declare module 'bindings' {
  interface KeyboardFrame {
    frame: number;
    timestamp: number;
    state: {
      justPressed: number[];
      held: number[];
      justReleased: number[];
      holdDurations: Record<string, number>;
    };
  }

  interface NativeModule {
    KeyboardMonitor: {
      new (callback: (eventName: string, data: KeyboardFrame) => void): {
        start(): void;
        stop(): void;
        setConfig(config: {
          isEnabled: boolean;
          isHyperKeyEnabled: boolean;
          trigger: string;
          modifiers: string[];
          capsLockBehavior?: string;
          bufferWindow?: number;
        }): void;
      };
    };
  }

  function bindings(name: string): NativeModule;
  export = bindings;
}
