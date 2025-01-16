import { Migration } from './types';
import { StoreSchema, Features } from '../schema';

export const migration: Migration = {
  version: '0.0.2',
  description: 'Adds enableFeatureOnStartup to feature state',
  up: async (store: StoreSchema): Promise<Partial<StoreSchema>> => {
    const features = store.features;
    const updatedFeatures = Object.entries(features).reduce<Features>(
      (acc, [key, feature]) => ({
        ...acc,
        [key]: {
          ...feature,
          enableFeatureOnStartup: feature.isFeatureEnabled,
        },
      }),
      {} as Features
    );

    return {
      features: updatedFeatures,
    };
  },
  down: async (store: StoreSchema): Promise<Partial<StoreSchema>> => {
    const features = store.features;
    const updatedFeatures = Object.entries(features).reduce<Features>(
      (acc, [key, feature]) => {
        const { enableFeatureOnStartup, ...rest } = feature;
        return {
          ...acc,
          [key]: rest,
        };
      },
      {} as Features
    );

    return {
      features: updatedFeatures,
    };
  },
};
