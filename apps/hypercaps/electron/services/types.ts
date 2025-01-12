export interface HyperKeyConfig {
  enabled: boolean;
  trigger: "capslock" | "alt" | "ctrl" | "shift" | "win";
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
}

export interface KeyMapping {
  id: string;
  sourceKey: string;
  targetModifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
  targetKey?: string;
  command?: string;
  enabled: boolean;
}
