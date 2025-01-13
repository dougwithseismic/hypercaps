export interface HyperKeyConfig {
  isHyperKeyEnabled: boolean;
  trigger: string;
  modifiers: string[];
  capsLockBehavior?: "None" | "DoublePress" | "BlockToggle";
}
