import { StoreSchema } from '../schema';

export interface Migration {
  version: string;
  description: string;
  up: (store: StoreSchema) => Promise<Partial<StoreSchema>>;
  down: (store: StoreSchema) => Promise<Partial<StoreSchema>>;
}

export interface MigrationResult {
  success: boolean;
  error?: Error;
  fromVersion: string;
  toVersion: string;
  store?: StoreSchema;
}

export type MigrationDirection = 'up' | 'down';
