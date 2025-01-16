export interface AppState {
  settings: {
    startupOnBoot: boolean;
    startMinimized: boolean;
  };
  features: Array<{
    name: string;
    isFeatureEnabled: boolean;
    enableFeatureOnStartup: boolean;
    config: any;
  }>;
}
