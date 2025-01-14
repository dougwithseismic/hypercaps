/**
 * IPC Service Contracts
 * Defines the type-safe communication contracts between main and renderer processes
 */

/**
 * Available IPC services
 */
export const IPC_SERVICES = {
  HYPERKEY: 'hyperkey',
  SHORTCUT: 'shortcut',
  STARTUP: 'startup',
  WINDOW: 'window',
} as const;

export type ServiceName = (typeof IPC_SERVICES)[keyof typeof IPC_SERVICES];

/**
 * Base contract shape for type safety
 */
export interface BaseContract {
  [key: string]: {
    params: unknown;
    result: unknown;
  };
}

/**
 * HyperKey service contract
 */
export interface HyperKeyContract extends BaseContract {
  getConfig: {
    params: void;
    result: {
      enabled: boolean;
      mappings: Array<{
        id: string;
        sourceKey: string;
        targetKey?: string;
        command?: string;
        enabled: boolean;
      }>;
    };
  };
  setConfig: {
    params: {
      enabled: boolean;
      mappings: Array<{
        id: string;
        sourceKey: string;
        targetKey?: string;
        command?: string;
        enabled: boolean;
      }>;
    };
    result: void;
  };
}

/**
 * Startup service contract
 */
export interface StartupContract extends BaseContract {
  getSettings: {
    params: void;
    result: {
      startOnBoot: boolean;
      startMinimized: boolean;
    };
  };
  setStartOnBoot: {
    params: {
      enabled: boolean;
    };
    result: void;
  };
  setStartMinimized: {
    params: {
      enabled: boolean;
    };
    result: void;
  };
}

/**
 * Window service contract
 */
export interface WindowContract extends BaseContract {
  minimize: {
    params: void;
    result: void;
  };
  close: {
    params: void;
    result: void;
  };
}

/**
 * Service contract mapping
 */
type ServiceContractMap = {
  [IPC_SERVICES.HYPERKEY]: HyperKeyContract;
  [IPC_SERVICES.STARTUP]: StartupContract;
  [IPC_SERVICES.WINDOW]: WindowContract;
};

/**
 * Combined service contracts
 */
export type IPCContracts = {
  [K in ServiceName]: K extends keyof ServiceContractMap
    ? ServiceContractMap[K]
    : never;
};

/**
 * Type helper for extracting action names from a service
 */
export type ServiceActions<TService extends ServiceName> =
  TService extends keyof ServiceContractMap
    ? keyof ServiceContractMap[TService]
    : never;

/**
 * Type helper for extracting params type for a specific action
 */
export type ActionParams<
  TService extends ServiceName,
  TAction extends ServiceActions<TService>,
> = TService extends keyof ServiceContractMap
  ? TAction extends keyof ServiceContractMap[TService]
    ? ServiceContractMap[TService][TAction] extends { params: any }
      ? ServiceContractMap[TService][TAction]['params']
      : never
    : never
  : never;

/**
 * Type helper for extracting result type for a specific action
 */
export type ActionResult<
  TService extends ServiceName,
  TAction extends ServiceActions<TService>,
> = TService extends keyof ServiceContractMap
  ? TAction extends keyof ServiceContractMap[TService]
    ? ServiceContractMap[TService][TAction] extends { result: any }
      ? ServiceContractMap[TService][TAction]['result']
      : never
    : never
  : never;
