import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { HyperKeyFeatureConfig, KeyMapping } from "./types";

type FeatureName = "hyperKey" | "test";

interface TestFeatureConfig {
  testSetting: string;
}

// Set features
type FeatureConfig = {
  hyperKey: HyperKeyFeatureConfig;
  test: TestFeatureConfig;
};

interface Feature<T extends FeatureName> {
  name: T;
  isEnabled: boolean;
  config: FeatureConfig[T];
}

export interface AppState {
  mappings: KeyMapping[];
  startupOnBoot: boolean;
  enableOnStartup: boolean;
  features: Feature<FeatureName>[];
}

export class Store {
  private static instance: Store;
  private state: AppState;
  private filePath: string;

  private constructor() {
    this.filePath = path.join(app.getPath("userData"), "state.json");
    this.state = {
      mappings: [],
      startupOnBoot: false,
      enableOnStartup: true,
      features: [
        {
          name: "hyperKey",
          isEnabled: true,
          config: {
            isHyperKeyEnabled: true,
            trigger: "CapsLock",
            modifiers: ["LShiftKey"],
          },
        },
      ],
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
      const loadedState = JSON.parse(data);

      // Migrate old hyperKeyConfig to feature system
      if (
        "hyperKeyConfig" in loadedState ||
        "isServiceEnabled" in loadedState
      ) {
        loadedState.features = loadedState.features || [];

        // Only migrate if hyperKey feature doesn't exist
        if (
          !loadedState.features.some(
            (f: Feature<FeatureName>) => f.name === "hyperKey"
          )
        ) {
          const isEnabled = loadedState.isServiceEnabled ?? false;
          const config = loadedState.hyperKeyConfig ?? {
            isEnabled,
            trigger: "CapsLock",
            modifiers: ["LShiftKey"],
          };

          loadedState.features.push({
            name: "hyperKey",
            isEnabled,
            config: {
              ...config,
              isEnabled,
            },
          });
        }

        // Clean up old properties
        delete loadedState.hyperKeyConfig;
        delete loadedState.isServiceEnabled;
      }

      this.state = loadedState;
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

  // Feature management methods
  public async getFeature<T extends FeatureName>(
    name: T
  ): Promise<Feature<T> | undefined> {
    return this.state.features.find((f) => f.name === name) as Feature<T>;
  }

  public async updateFeature<T extends FeatureName>(
    name: T,
    updates: Partial<Feature<T>>
  ): Promise<Feature<T>> {
    const index = this.state.features.findIndex((f) => f.name === name);
    if (index === -1) {
      throw new Error(`Feature ${name} not found`);
    }

    const updatedFeature = {
      ...this.state.features[index],
      ...updates,
    } as Feature<T>;

    this.state.features[index] = updatedFeature;
    await this.save();
    return updatedFeature;
  }

  // HyperKey config methods
  public async getHyperKeyConfig(): Promise<HyperKeyFeatureConfig> {
    const hyperKeyFeature = this.state.features.find(
      (f): f is Feature<"hyperKey"> => f.name === "hyperKey"
    );

    if (!hyperKeyFeature) {
      // Create default config if not found
      const defaultConfig: Feature<"hyperKey"> = {
        name: "hyperKey",
        isEnabled: true,
        config: {
          isHyperKeyEnabled: true,
          trigger: "CapsLock",
          modifiers: ["LShiftKey"],
        },
      };
      this.state.features.push(defaultConfig);
      await this.save();
      return defaultConfig.config;
    }
    return hyperKeyFeature.config;
  }

  public async setHyperKeyConfig(config: HyperKeyFeatureConfig): Promise<void> {
    const hyperKeyFeature = this.state.features.find(
      (f): f is Feature<"hyperKey"> => f.name === "hyperKey"
    );
    if (hyperKeyFeature) {
      hyperKeyFeature.config = config;
    } else {
      this.state.features.push({
        name: "hyperKey",
        isEnabled: config.isHyperKeyEnabled,
        config,
      });
    }
    await this.save();
  }

  // Service state methods
  public async getIsServiceEnabled(): Promise<boolean> {
    const hyperKeyFeature = this.state.features.find(
      (f): f is Feature<"hyperKey"> => f.name === "hyperKey"
    );
    return hyperKeyFeature?.isEnabled ?? false;
  }

  public async setIsServiceEnabled(enabled: boolean): Promise<void> {
    const hyperKeyFeature = this.state.features.find(
      (f): f is Feature<"hyperKey"> => f.name === "hyperKey"
    );
    if (hyperKeyFeature) {
      hyperKeyFeature.isEnabled = enabled;
      hyperKeyFeature.config.isHyperKeyEnabled = enabled;
    }
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

  // Get full store state
  public async getFullState(): Promise<AppState> {
    return { ...this.state };
  }
}
