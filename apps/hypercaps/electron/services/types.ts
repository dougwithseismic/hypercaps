export interface HyperKeyConfig {
  enabled: boolean;
  trigger: string;
  modifiers: string[];
  capsLockBehavior?: "None" | "DoublePress" | "BlockToggle";
}

export type ActionType = "command" | "shortcut" | "script";

export interface KeyMapping {
  id: string;
  name: string; // Human readable name for the mapping
  description?: string; // Optional description
  triggers: string[]; // Array of keys that trigger this mapping (e.g. ["CapsLock", "A"])
  actionType: ActionType; // Type of action to perform
  action: string; // The actual command/shortcut/script to execute
  enabled: boolean; // Whether this mapping is active
  options?: {
    workingDirectory?: string; // For commands/scripts: working directory
    runAsAdmin?: boolean; // For commands: run with elevated privileges
    shell?: string; // For commands: specific shell to use
    async?: boolean; // Whether to run asynchronously
  };
  metadata?: {
    createdAt: number; // Timestamp when created
    lastModified: number; // Timestamp when last modified
    lastUsed?: number; // Timestamp when last triggered
    useCount?: number; // Number of times triggered
  };
}
