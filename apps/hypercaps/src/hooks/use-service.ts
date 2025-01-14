import { useCallback, useEffect } from 'react';
import { ipc, createCommand } from '../lib/ipc/client';
import type {
  IPCEvent,
  IPCEventHandler,
} from '@electron/features/shortcut-manager/services/ipc/types';

/**
 * Hook for interacting with IPC services
 * Provides type-safe methods for running commands and subscribing to events
 */
export function useService<TEvents = unknown>(serviceId: string) {
  /**
   * Run a command on the service
   */
  const run = useCallback(
    async <TParams = void, TResult = void>(
      action: string,
      params?: TParams
    ): Promise<TResult> => {
      const command = createCommand(serviceId, action, params);
      return ipc.run<TParams, TResult>(command);
    },
    [serviceId]
  );

  /**
   * Subscribe to service events
   */
  const subscribe = useCallback(
    <TData = TEvents>(
      event: string,
      handler: IPCEventHandler<TData>,
      deps: unknown[] = []
    ) => {
      useEffect(() => {
        const unsubscribe = ipc.on(serviceId, event, handler);
        return () => unsubscribe();
      }, [event, ...deps]);
    },
    [serviceId]
  );

  return {
    run,
    subscribe,
  };
}

// Example usage:
/*
interface KeyboardEvents {
  keyPressed: { key: string; modifiers: string[] };
  keyReleased: { key: string };
}

function MyComponent() {
  const keyboard = useService<KeyboardEvents>('keyboard');

  useEffect(() => {
    keyboard.subscribe('keyPressed', (event) => {
      // Type-safe event handling
      console.log(event.data.key, event.data.modifiers);
    });
  }, []);

  const handleStart = async () => {
    // Type-safe command parameters and result
    await keyboard.run('start', { mode: 'gaming' });
  };
}
*/
