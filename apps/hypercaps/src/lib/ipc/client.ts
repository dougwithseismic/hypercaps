import type { IPCCommand, IPCEventHandler } from "@electron/services/ipc/types";

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
        ) => Promise<TResult>;
        on: <TData = unknown>(
          service: string,
          event: string,
          callback: (data: TData) => void
        ) => () => void;
      };
      getHyperKeyConfig: () => Promise<any>;
      setHyperKeyConfig: (config: any) => Promise<void>;
      getStartupSettings: () => Promise<any>;
      setStartupOnBoot: (enabled: boolean) => Promise<void>;
      setStartMinimized: (enabled: boolean) => Promise<void>;
      getFullState: () => Promise<any>;
      minimizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

/**
 * Client-side IPC service for communicating with the main process
 * Provides a clean API for running commands and subscribing to events
 */
class IPCClient {
  private static instance: IPCClient;
  private eventHandlers: Map<string, Set<Function>>;

  private constructor() {
    this.eventHandlers = new Map();
  }

  public static getInstance(): IPCClient {
    if (!IPCClient.instance) {
      IPCClient.instance = new IPCClient();
    }
    return IPCClient.instance;
  }

  /**
   * Run a command on a service
   */
  public async run<TParams = unknown, TResult = unknown>(
    command: IPCCommand<TParams>
  ): Promise<TResult> {
    console.log("[IPCClient] Running command:", command);
    const result = await window.api.ipc.run<TParams, TResult>(command);
    console.log("[IPCClient] Command result:", result);
    return result;
  }

  /**
   * Subscribe to events from a service
   */
  public on<TData = unknown>(
    service: string,
    event: string,
    handler: IPCEventHandler<TData>
  ): () => void {
    const channel = `${service}:${event}`;
    console.log("[IPCClient] Setting up event listener:", channel);

    // Create a set for this channel if it doesn't exist
    if (!this.eventHandlers.has(channel)) {
      this.eventHandlers.set(channel, new Set());
    }

    // Add the handler
    this.eventHandlers.get(channel)?.add(handler);

    // Set up the bridge listener
    const unsubscribe = window.api.ipc.on<TData>(
      service,
      event,
      (eventData: TData) => {
        console.log("[IPCClient] Received event data:", eventData);
        this.eventHandlers.get(channel)?.forEach((h) => {
          console.log("[IPCClient] Calling handler for channel:", channel);
          h({ data: eventData });
        });
      }
    );

    // Return cleanup function
    return () => {
      console.log("[IPCClient] Cleaning up event listener:", channel);
      this.eventHandlers.get(channel)?.delete(handler);
      if (this.eventHandlers.get(channel)?.size === 0) {
        this.eventHandlers.delete(channel);
        unsubscribe();
      }
    };
  }
}

// Export singleton instance
export const ipc = IPCClient.getInstance();

// Export type-safe helper for creating commands
export const createCommand = <TParams = void>(
  service: string,
  action: string,
  params?: TParams
): IPCCommand<TParams> => ({
  service,
  action,
  params,
});
