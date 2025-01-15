import type { IPCCommand, IPCResult } from './types';
import type { ServiceName, ServiceActions, ActionParams } from './contracts';

export * from './types';
export * from './contracts';
export * from './ipc-service';
export * from './ipc-client';

// Re-export the singleton instance
export { ipc } from './ipc-service';

declare global {
  interface Window {
    electron: {
      minimize: () => void;
      close: () => void;
    };
    api: {
      ipc: {
        run: <TParams = unknown, TResult = unknown>(
          command: IPCCommand<TParams>
        ) => Promise<IPCResult<TResult>>;
        on: <TData = unknown>(
          service: string,
          event: string,
          callback: (data: TData) => void
        ) => () => void;
      };
    };
  }
}

/**
 * Type-safe command creation helper
 */
export const createCommand = <
  TService extends ServiceName,
  TAction extends ServiceActions<TService>,
>(
  service: TService,
  action: TAction,
  params?: ActionParams<TService, TAction>
): IPCCommand<ActionParams<TService, TAction>> => ({
  service: service.toString(),
  action: action.toString(),
  params,
});
