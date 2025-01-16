import semver from 'semver';
import { Migration, MigrationDirection, MigrationResult } from './types';
import { StoreSchema } from '../schema';

export class MigrationManager {
  private migrations: Migration[] = [];

  constructor(private currentVersion: string) {}

  /**
   * Registers a new migration
   * @param migration Migration to register
   */
  public register(migration: Migration): void {
    // Ensure version is valid
    if (!semver.valid(migration.version)) {
      throw new Error(`Invalid version ${migration.version} for migration`);
    }

    // Add migration and sort by version
    this.migrations.push(migration);
    this.migrations.sort((a, b) => semver.compare(a.version, b.version));
  }

  /**
   * Gets all migrations between two versions
   * @param fromVersion Starting version
   * @param toVersion Target version
   * @returns List of migrations to run
   */
  private getMigrationPath(
    fromVersion: string,
    toVersion: string
  ): { migrations: Migration[]; direction: MigrationDirection } {
    const isUpgrade = semver.gt(toVersion, fromVersion);
    let applicableMigrations = this.migrations.filter((migration) => {
      if (isUpgrade) {
        return (
          semver.gt(migration.version, fromVersion) &&
          semver.lte(migration.version, toVersion)
        );
      } else {
        return (
          semver.lt(migration.version, fromVersion) &&
          semver.gte(migration.version, toVersion)
        );
      }
    });

    if (!isUpgrade) {
      applicableMigrations = applicableMigrations.reverse();
    }

    return {
      migrations: applicableMigrations,
      direction: isUpgrade ? 'up' : 'down',
    };
  }

  /**
   * Migrates the store schema to the target version
   * @param store Current store schema
   * @param targetVersion Version to migrate to
   * @returns Migration result
   */
  public async migrate(
    store: StoreSchema,
    targetVersion: string
  ): Promise<MigrationResult> {
    try {
      // Validate versions
      if (!semver.valid(this.currentVersion)) {
        throw new Error(`Invalid current version: ${this.currentVersion}`);
      }
      if (!semver.valid(targetVersion)) {
        throw new Error(`Invalid target version: ${targetVersion}`);
      }

      // Get migration path
      const { migrations, direction } = this.getMigrationPath(
        this.currentVersion,
        targetVersion
      );

      // No migrations needed
      if (migrations.length === 0) {
        return {
          success: true,
          fromVersion: this.currentVersion,
          toVersion: targetVersion,
          store,
        };
      }

      // Apply migrations in sequence
      let currentSchema = { ...store };
      for (const migration of migrations) {
        const migrationFn = direction === 'up' ? migration.up : migration.down;
        const changes = await migrationFn(currentSchema);
        currentSchema = { ...currentSchema, ...changes };
      }

      return {
        success: true,
        fromVersion: this.currentVersion,
        toVersion: targetVersion,
        store: currentSchema,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        fromVersion: this.currentVersion,
        toVersion: targetVersion,
      };
    }
  }

  /**
   * Gets list of available migrations
   */
  public getAvailableMigrations(): Migration[] {
    return [...this.migrations];
  }
}
