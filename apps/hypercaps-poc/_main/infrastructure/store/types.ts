export interface AppConfig {
  version: string;
  firstRun: boolean;
  theme: 'light' | 'dark' | 'system';
  startMinimized: boolean;
  startWithSystem: boolean;
}

export interface WindowConfig {
  bounds: {
    x: number | undefined;
    y: number | undefined;
    width: number;
    height: number;
  };
  isMaximized: boolean;
}

export interface StoreSchema {
  app: AppConfig;
  window: WindowConfig;
}

export const DEFAULT_CONFIG: StoreSchema = {
  app: {
    version: '1.0.0',
    firstRun: true,
    theme: 'system',
    startMinimized: false,
    startWithSystem: false,
  },
  window: {
    bounds: {
      x: undefined,
      y: undefined,
      width: 800,
      height: 600,
    },
    isMaximized: false,
  },
};
