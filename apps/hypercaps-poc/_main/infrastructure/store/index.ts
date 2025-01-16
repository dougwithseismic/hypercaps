import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';
import { StoreEventEmitter } from './events';
import {
  AppConfig,
  WindowConfig,
  WindowBounds,
  Features,
  StoreSchema,
  DEFAULT_CONFIG,
} from './schema';
import { MigrationManager } from './migrations/manager';
import { migration as migration_0_0_2 } from './migrations/0.0.2';

export interface StoreInstance extends Store<StoreSchema> {}

/**
 * Manages application configuration and state storage using electron-store
 * @example
 * ```ts
 * // Get store instance
 * const store = StoreManager.getInstance();
 *
 * // Get app config
 * const appConfig = store.getAppConfig();
 *
 * // Update app config
 * store.setAppConfig({ theme: 'dark' });
 *
 * // Listen for changes
 * store.events.on('app:config:changed', ({ config }) => {
 *   console.log('App config changed:', config);
 * });
 * ```
 */
class StoreManager {
  private static instance: StoreManager;
  private store: Store<StoreSchema>;
  private migrationManager: MigrationManager;
  public events: StoreEventEmitter;

  private constructor() {
    this.store = new Store<StoreSchema>({
      name: 'config',
      defaults: DEFAULT_CONFIG,
      cwd:
        process.env.NODE_ENV === 'development'
          ? process.cwd()
          : path.join(app.getPath('appData'), 'hypercaps'),
    });
    this.events = new StoreEventEmitter();

    // Initialize migration manager with current version
    this.migrationManager = new MigrationManager(this.getAppConfig().version);
    this.registerMigrations();
  }

  private registerMigrations(): void {
    // Register all migrations
    this.migrationManager.register(migration_0_0_2);
  }

  /**
   * Migrates the store to a specific version
   * @param targetVersion Version to migrate to
   * @returns Migration result
   */
  public async migrate(targetVersion: string) {
    const result = await this.migrationManager.migrate(
      this.store.store,
      targetVersion
    );

    if (result.success && result.store) {
      // Update store with migrated data
      this.store.store = result.store;
      // Update version
      await this.setAppConfig({ version: targetVersion });
    }

    return result;
  }

  /**
   * Gets the singleton instance of StoreManager
   * @returns {StoreManager} The StoreManager instance
   * @example
   * ```ts
   * const store = StoreManager.getInstance();
   * ```
   */
  public static getInstance(): StoreManager {
    if (!StoreManager.instance) {
      StoreManager.instance = new StoreManager();
    }
    return StoreManager.instance;
  }

  /**
   * Gets the current app configuration
   * @returns {AppConfig} The current app configuration
   * @example
   * ```ts
   * const appConfig = store.getAppConfig();
   * console.log(appConfig.theme); // 'light' | 'dark' | 'system'
   * ```
   */
  public getAppConfig(): AppConfig {
    return this.store.get('app');
  }

  /**
   * Updates the app configuration
   * @param {Partial<AppConfig>} config - Partial app configuration to update
   * @example
   * ```ts
   * store.setAppConfig({
   *   theme: 'dark',
   *   startMinimized: true
   * });
   * ```
   */
  public setAppConfig(config: Partial<AppConfig>): void {
    const newConfig = { ...this.store.get('app'), ...config };
    this.store.set('app', newConfig);
    this.events.emit('app:config:changed', { config });
  }

  /**
   * Gets the current window configuration
   * @returns {WindowConfig} The current window configuration
   * @example
   * ```ts
   * const windowConfig = store.getWindowConfig();
   * console.log(windowConfig.bounds); // Window position and size
   * ```
   */
  public getWindowConfig(): WindowConfig {
    return this.store.get('window');
  }

  /**
   * Updates the window configuration
   * @param {Partial<WindowConfig>} config - Partial window configuration to update
   * @example
   * ```ts
   * store.setWindowConfig({
   *   isMaximized: true
   * });
   * ```
   */
  public setWindowConfig(config: Partial<WindowConfig>): void {
    const newConfig = { ...this.store.get('window'), ...config };
    this.store.set('window', newConfig);
    this.events.emit('window:config:changed', { config });
  }

  /**
   * Updates the window bounds
   * @param {Partial<WindowBounds>} bounds - Partial window bounds to update
   * @example
   * ```ts
   * store.setWindowBounds({
   *   width: 800,
   *   height: 600,
   *   x: 100,
   *   y: 100
   * });
   * ```
   */
  public setWindowBounds(bounds: Partial<WindowBounds>): void {
    const windowConfig = this.store.get('window');
    const newBounds = { ...windowConfig.bounds, ...bounds };
    const newConfig = {
      ...windowConfig,
      bounds: newBounds,
    };
    this.store.set('window', newConfig);
    this.events.emit('window:config:changed', {
      config: { bounds: newBounds },
    });
  }

  /**
   * Gets configuration for a specific feature
   * @param {K} feature - Feature key to get configuration for
   * @returns {Features[K]} The feature configuration
   * @example
   * ```ts
   * const remapperConfig = store.getFeatureConfig('remapper');
   * console.log(remapperConfig.isFeatureEnabled);
   * ```
   */
  public getFeatureConfig<K extends keyof Features>(feature: K): Features[K] {
    return this.store.get('features')[feature];
  }

  /**
   * Updates configuration for a specific feature
   * @param {K} feature - Feature key to update
   * @param {Partial<Features[K]['config']>} config - Partial feature configuration
   * @example
   * ```ts
   * store.setFeatureConfig('remapper', {
   *   keyMaps: [{ from: 'a', to: 'b' }]
   * });
   * ```
   */
  public setFeatureConfig<K extends keyof Features>(
    feature: K,
    config: Partial<Features[K]['config']>
  ): void {
    const features = this.store.get('features');
    const current = features[feature];
    const newFeatures = {
      ...features,
      [feature]: {
        ...current,
        config: { ...current.config, ...config },
      },
    };
    this.store.set('features', newFeatures);
    this.events.emit('feature:config:changed', {
      feature,
      config: newFeatures[feature].config,
    });
  }

  /**
   * Enables or disables a specific feature
   * @param {K} feature - Feature key to enable/disable
   * @param {boolean} enabled - Whether to enable or disable the feature
   * @example
   * ```ts
   * store.setFeatureEnabled('remapper', true);
   * ```
   */
  public setFeatureEnabled<K extends keyof Features>(
    feature: K,
    enabled: boolean
  ): void {
    const features = this.store.get('features');
    const current = features[feature];
    const newFeatures = {
      ...features,
      [feature]: {
        ...current,
        isFeatureEnabled: enabled,
      },
    };
    this.store.set('features', newFeatures);
    this.events.emit('feature:enabled:changed', { feature, enabled });
  }

  /**
   * Resets the store to default configuration
   * @example
   * ```ts
   * store.resetStore();
   * ```
   */
  public resetStore(): void {
    this.store.clear();
    this.store.set(DEFAULT_CONFIG);
    this.events.emit('store:reset', undefined);
  }

  /**
   * Cleans up event listeners
   * @example
   * ```ts
   * store.dispose();
   * ```
   */
  public dispose(): void {
    this.events.removeAllListeners();
  }

  /**
   * Gets a value from the store using dot notation
   * @param key - Key to get using dot notation
   * @returns The value at the specified key
   * @example
   * ```ts
   * const remapperConfig = store.get('features.remapper');
   * const theme = store.get('app.theme');
   * ```
   */
  public get<K extends keyof StoreSchema>(key: K): StoreSchema[K];
  public get<T = unknown>(key: string): T;
  public get(key: string) {
    return this.store.get(key);
  }

  /**
   * Sets a value in the store using dot notation
   * @param key - Key to set using dot notation
   * @param value - Value to set
   * @example
   * ```ts
   * store.set('features.remapper.config', newConfig);
   * store.set('app.theme', 'dark');
   * ```
   */
  public set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
  public set<T>(key: string, value: T): void;
  public set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

export const store = StoreManager.getInstance();

// Re-export types
export type { AppConfig, WindowConfig, WindowBounds, Features, StoreSchema };
