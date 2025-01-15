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
export type KeyboardEventCallback = (eventName: string, data: KeyboardFrame) => void;
export declare class KeyboardMonitor {
    private monitor;
    constructor(callback: KeyboardEventCallback);
    start(): void;
    stop(): void;
    setConfig(config: KeyboardConfig): void;
}
