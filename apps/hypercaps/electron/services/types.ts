export interface HyperKeyConfig {
  enabled: boolean;
  trigger: string;
  modifiers: string[];
  capsLockBehavior?: "None" | "DoublePress" | "BlockToggle";
}

export interface KeyMapping {
  id: string;
  triggers: string[];
  command?: string;
  enabled: boolean;
}
