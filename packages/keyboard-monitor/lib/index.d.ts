import type { KeyboardConfig, KeyboardFrame } from './types/keyboard';
export * from './types/keyboard';
export type KeyboardEventCallback = (eventName: string, data: KeyboardFrame) => void;
export declare class KeyboardMonitor {
    private monitor;
    constructor(callback: KeyboardEventCallback);
    start(): void;
    stop(): void;
    setConfig(config: KeyboardConfig): void;
}
