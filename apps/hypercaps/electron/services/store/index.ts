import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { produce } from "immer";
import { AppState } from "./types/app-state";
import { Feature, FeatureName } from "./types/feature-config";

const DEFAULT_STATE: AppState = {
  startupOnBoot: false,
  enableOnStartup: true,
  features: [
    {
      name: "hyperKey",
      isFeatureEnabled: true,
      config: {
        enableOnStartup: true,
        isHyperKeyEnabled: true,
        trigger: "CapsLock",
        modifiers: ["LShiftKey"],
      },
    },
  ],
};

export class Store {
  private static instance: Store;
  private state: AppState;
  private filePath: string;

  private constructor() {
    this.filePath = path.join(app.getPath("userData"), "state.json");
    this.state = DEFAULT_STATE;
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

  // Generic state update method using Immer
  public async update(recipe: (draft: AppState) => void): Promise<void> {
    this.state = produce(this.state, recipe);
    await this.save();
  }

  // Convenience methods
  public getState(): AppState {
    return this.state;
  }

  public async getFeature<T extends FeatureName>(
    name: T
  ): Promise<Feature<T> | undefined> {
    return this.state.features.find((f) => f.name === name) as Feature<T>;
  }

  // Startup settings with electron integration
  public async setStartupOnBoot(enabled: boolean): Promise<void> {
    await this.update((draft) => {
      draft.startupOnBoot = enabled;
    });

    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: enabled ? app.getPath("exe") : undefined,
    });
  }
}
