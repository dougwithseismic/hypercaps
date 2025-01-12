import { app } from "electron";
import path from "path";
import fs from "fs/promises";

interface HyperKeyConfig {
  enabled: boolean;
  trigger: "capslock" | "alt" | "ctrl" | "shift" | "win";
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
}

interface KeyMapping {
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

interface AppState {
  mappings: KeyMapping[];
  isEnabled: boolean;
  startupOnBoot: boolean;
  enableOnStartup: boolean;
  hyperKeyConfig: HyperKeyConfig;
}

export class Store {
  private static instance: Store;
  private state: AppState;
  private filePath: string;

  private constructor() {
    this.filePath = path.join(app.getPath("userData"), "state.json");
    this.state = {
      mappings: [],
      isEnabled: true,
      startupOnBoot: false,
      enableOnStartup: true,
      hyperKeyConfig: {
        enabled: false,
        trigger: "capslock",
        modifiers: {
          ctrl: false,
          alt: false,
          shift: false,
          win: false,
        },
      },
    };
  }

  public static getInstance(): Store {
    if (!Store.instance) {
      Store.instance = new Store();
    }
    return Store.instance;
  }

  public async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.state = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or is invalid, use default state
      await this.save();
    }
  }

  private async save(): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error("Failed to save state:", error);
    }
  }

  // Mapping methods
  public async getMappings(): Promise<KeyMapping[]> {
    return this.state.mappings;
  }

  public async addMapping(
    mapping: Omit<KeyMapping, "id">
  ): Promise<KeyMapping> {
    const newMapping = {
      ...mapping,
      id: Date.now().toString(),
    };
    this.state.mappings.push(newMapping);
    await this.save();
    return newMapping;
  }

  public async updateMapping(
    id: string,
    updates: Partial<KeyMapping>
  ): Promise<KeyMapping> {
    const index = this.state.mappings.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error("Mapping not found");
    }

    const updatedMapping = {
      ...this.state.mappings[index],
      ...updates,
    };
    this.state.mappings[index] = updatedMapping;
    await this.save();
    return updatedMapping;
  }

  public async deleteMapping(id: string): Promise<void> {
    this.state.mappings = this.state.mappings.filter((m) => m.id !== id);
    await this.save();
  }

  // Service state methods
  public async getIsEnabled(): Promise<boolean> {
    return this.state.isEnabled;
  }

  public async setIsEnabled(enabled: boolean): Promise<void> {
    this.state.isEnabled = enabled;
    await this.save();
  }

  // Startup settings methods
  public async getStartupOnBoot(): Promise<boolean> {
    return this.state.startupOnBoot;
  }

  public async setStartupOnBoot(enabled: boolean): Promise<void> {
    this.state.startupOnBoot = enabled;
    if (enabled) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath("exe"),
      });
    } else {
      app.setLoginItemSettings({
        openAtLogin: false,
      });
    }
    await this.save();
  }

  public async getEnableOnStartup(): Promise<boolean> {
    return this.state.enableOnStartup;
  }

  public async setEnableOnStartup(enabled: boolean): Promise<void> {
    this.state.enableOnStartup = enabled;
    await this.save();
  }

  // HyperKey config methods
  public async getHyperKeyConfig(): Promise<HyperKeyConfig> {
    return this.state.hyperKeyConfig;
  }

  public async setHyperKeyConfig(config: HyperKeyConfig): Promise<void> {
    this.state.hyperKeyConfig = config;
    await this.save();
  }
}
