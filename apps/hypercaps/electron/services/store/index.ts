/**
 * Store Service
 *
 * Handles persistent configuration and feature settings.
 * This service is separate from the MessageQueue, which handles real-time events.
 *
 * Key responsibilities:
 * 1. Persistent configuration storage
 * 2. Feature settings management
 * 3. State migration between versions
 * 4. Startup preferences
 *
 * This store ensures:
 * - Configuration persists between app restarts
 * - Settings are properly migrated during updates
 * - Feature states are consistently maintained
 *
 * @note This is NOT for real-time state - use MessageQueue service for that
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { produce } from 'immer';
import { z } from 'zod';
import { AppState, AppStateSchema } from './types/app-state';
import { Feature, FeatureName } from './types/feature-config';
import { EventEmitter } from 'events';

// Get version from package.json
const pkg = require(path.join(app.getAppPath(), 'package.json'));
const CURRENT_STATE_VERSION = pkg.version;

// Version when each migration was introduced
type MigrationFunction = (state: AppState) => AppState;
interface Migration {
  version: string;
  schema: z.ZodType<any>;
  migrate: MigrationFunction;
}

interface OldPattern {
  sequence: Array<{
    type?: string;
    keys: string[];
    buffer?: {
      holdTime?: number;
    };
    window?: number;
  }>;
  window: number;
  defaultBuffer?: any;
}

const MIGRATIONS: Migration[] = [
  // {
  //   version: "0.1.0",
  //   schema: AppStateSchema.extend({
  //     features: z.array(
  //       z.object({
  //         name: z.enum(["hyperKey", "shortcutManager"]),
  //         isFeatureEnabled: z.boolean(),
  //         // enableFeatureOnStartup might not exist yet
  //         config: z.any(),
  //       })
  //     ),
  //   }),
  //   migrate: (state: AppState) => {
  //     console.log("[Store] Migrating state to version 0.1.0");
  //     return produce(state, (draft) => {
  //       // Migrate features to include enableFeatureOnStartup
  //       draft.features?.forEach((feature) => {
  //         if (!("enableFeatureOnStartup" in feature)) {
  //           feature.enableFeatureOnStartup = feature.isFeatureEnabled || false;
  //         }
  //       });
  //       // Ensure settings object exists
  //       if (!draft.settings) {
  //         draft.settings = {
  //           startupOnBoot: false,
  //           startMinimized: false,
  //         };
  //       }
  //     });
  //   },
  // },
  // {
  //   version: "0.2.0",
  //   schema: AppStateSchema.extend({
  //     features: z.array(
  //       z.object({
  //         name: z.enum(["hyperKey", "shortcutManager"]),
  //         isFeatureEnabled: z.boolean(),
  //         enableFeatureOnStartup: z.boolean(),
  //         config: z.any(),
  //       })
  //     ),
  //   }),
  //   migrate: (state: AppState) => {
  //     console.log("[Store] Migrating state to version 0.2.0");
  //     return produce(state, (draft) => {
  //       // Migrate shortcut manager shortcuts to use new trigger format
  //       draft.features?.forEach((feature) => {
  //         if (feature.name === "shortcutManager") {
  //           const config = feature.config as any;
  //           if (config?.shortcuts) {
  //             config.shortcuts = config.shortcuts.map((shortcut: any) => {
  //               if ("triggerKey" in shortcut) {
  //                 // Get HyperKey config to include its modifiers
  //                 const hyperKey = draft.features?.find(
  //                   (f) => f.name === "hyperKey"
  //                 )?.config;
  //                 const keys = [
  //                   ...(hyperKey?.modifiers || []),
  //                   shortcut.triggerKey,
  //                 ].filter(Boolean);
  //                 // Convert old triggerKey to new trigger format
  //                 const newShortcut = {
  //                   ...shortcut,
  //                   trigger: {
  //                     steps: [
  //                       {
  //                         type: "combo" as const,
  //                         keys,
  //                         timeWindow: 200,
  //                       },
  //                     ],
  //                     totalTimeWindow: 500,
  //                   },
  //                 };
  //                 delete newShortcut.triggerKey;
  //                 return newShortcut;
  //               }
  //               return shortcut;
  //             });
  //           }
  //         }
  //       });
  //     });
  //   },
  // },
  // {
  //   version: "0.3.0",
  //   schema: AppStateSchema.extend({
  //     features: z.array(
  //       z.object({
  //         name: z.enum(["hyperKey", "shortcutManager"]),
  //         isFeatureEnabled: z.boolean(),
  //         enableFeatureOnStartup: z.boolean(),
  //         config: z.any(),
  //       })
  //     ),
  //   }),
  //   migrate: (state: AppState) => {
  //     // Convert shortcuts from pattern to trigger format
  //     const shortcutManager = state.features.find(
  //       (f) => f.name === "shortcutManager"
  //     );
  //     if (shortcutManager?.config?.shortcuts) {
  //       const shortcuts = shortcutManager.config.shortcuts as OldShortcut[];
  //       shortcuts.forEach((shortcut) => {
  //         if ("pattern" in shortcut) {
  //           const oldPattern = shortcut.pattern;
  //           // Convert to new trigger format
  //           const trigger = {
  //             steps: oldPattern.sequence.map((step) => {
  //               // Extract holdTime from buffer if it exists
  //               const holdTime = step.buffer?.holdTime;
  //               return {
  //                 type:
  //                   step.type || (step.keys.length > 1 ? "combo" : "single"),
  //                 keys: step.keys,
  //                 holdTime: holdTime,
  //                 window: step.window || oldPattern.window,
  //               };
  //             }),
  //             totalTimeWindow: oldPattern.window,
  //             defaultBuffer: oldPattern.defaultBuffer,
  //           };
  //           // Replace pattern with trigger
  //           delete (shortcut as any).pattern;
  //           (shortcut as any).trigger = trigger;
  //         }
  //       });
  //     }
  //     return state;
  //   },
  // },
];

interface VersionedState {
  version: string;
  state: AppState;
}

const DEFAULT_STATE: AppState = {
  settings: {
    startupOnBoot: false,
    startMinimized: false,
  },
  features: [
    {
      name: 'hyperKey',
      isFeatureEnabled: true,
      enableFeatureOnStartup: true,
      config: {
        isHyperKeyEnabled: true,
        trigger: 'CapsLock',
        modifiers: [],
        capsLockBehavior: 'BlockToggle',
      },
    },
    {
      name: 'shortcutManager',
      isFeatureEnabled: true,
      enableFeatureOnStartup: true,
      config: {
        shortcuts: [],
        isEnabled: true,
      },
    },
  ],
};

export class Store extends EventEmitter {
  private static instance: Store;
  private state: AppState = DEFAULT_STATE;
  private statePath: string;

  private constructor() {
    super();
    this.statePath =
      process.env.NODE_ENV === 'development'
        ? path.join(app.getAppPath(), 'state.json')
        : path.join(app.getPath('userData'), 'state.json');
  }

  public static getInstance(): Store {
    if (!Store.instance) {
      Store.instance = new Store();
    }
    return Store.instance;
  }

  public getState(): AppState {
    return this.state;
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      if (partA !== partB) return partA - partB;
    }
    return 0;
  }

  private validateState(state: unknown, schema: z.ZodType<any>): AppState {
    try {
      return schema.parse(state);
    } catch (error) {
      console.error('[Store] State validation failed:', error);
      if (error instanceof z.ZodError) {
        console.error(
          '[Store] Validation errors:',
          JSON.stringify(error.errors, null, 2)
        );
      }
      console.warn('[Store] Falling back to default state');
      return DEFAULT_STATE;
    }
  }

  private migrateState(versionedState: Partial<VersionedState>): AppState {
    const version = versionedState.version || '0.0.0';
    let state = versionedState.state || DEFAULT_STATE;

    // Sort migrations by version
    const sortedMigrations = [...MIGRATIONS].sort((a, b) =>
      this.compareVersions(a.version, b.version)
    );

    // Apply each migration if needed
    for (const migration of sortedMigrations) {
      if (this.compareVersions(version, migration.version) < 0) {
        console.log(
          `[Store] Validating state before migration ${migration.version}`
        );

        // Validate state before migration
        state = this.validateState(state, migration.schema);

        console.log(
          `[Store] Running migration for version ${migration.version}`
        );
        state = migration.migrate(state);

        console.log(
          `[Store] Validating state after migration ${migration.version}`
        );
        // Validate state after migration with the next migration's schema (or current app schema)
        const nextMigration = sortedMigrations.find(
          (m) => this.compareVersions(migration.version, m.version) < 0
        );
        state = this.validateState(
          state,
          nextMigration?.schema || AppStateSchema
        );
      }
    }

    // Final validation with current app schema
    return this.validateState(state, AppStateSchema);
  }

  public async load(): Promise<void> {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = await fs.promises.readFile(this.statePath, 'utf-8');
        const versionedState = JSON.parse(data) as Partial<VersionedState>;

        // Migrate state if needed
        this.state = this.migrateState(versionedState);

        // Save migrated state if version was old
        if (
          !versionedState.version ||
          this.compareVersions(versionedState.version, CURRENT_STATE_VERSION) <
            0
        ) {
          await this.save();
        }
      } else {
        this.state = DEFAULT_STATE;
        await this.save();
      }
    } catch (error) {
      console.error('Failed to load state:', error);
      this.state = DEFAULT_STATE;
      await this.save();
    }
  }

  private async save(): Promise<void> {
    try {
      const versionedState: VersionedState = {
        version: CURRENT_STATE_VERSION,
        state: this.state,
      };

      await fs.promises.writeFile(
        this.statePath,
        JSON.stringify(versionedState, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  public async update(updater: (draft: AppState) => void): Promise<void> {
    this.state = produce(this.state, updater);
    await this.save();
    // Emit state change event
    this.emit('stateChanged', this.state);
  }

  public async getFeature<T extends FeatureName>(
    name: T
  ): Promise<Feature<T> | undefined> {
    const feature = this.state.features?.find((f) => f.name === name);
    return feature as Feature<T> | undefined;
  }
}
