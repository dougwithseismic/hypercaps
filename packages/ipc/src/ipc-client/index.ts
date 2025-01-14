import type {
  IPCCommand,
  IPCEvent,
  IPCEventHandler,
  IPCResult,
} from '../types';

/**
 * Client-side IPC service for communicating with the main process
 * Provides a clean API for running commands and subscribing to events
 */
export class IPCClient {
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
  ): Promise<IPCResult<TResult>> {
    if (!window?.api?.ipc?.run) {
      throw new Error('IPC bridge not initialized');
    }
    console.log('[IPCClient] Running command:', command);
    const result = await window.api.ipc.run<TParams, TResult>(command);
    console.log('[IPCClient] Command result:', result);
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
    if (!window?.api?.ipc?.on) {
      throw new Error('IPC bridge not initialized');
    }

    const channel = `${service}:${event}`;
    console.log('[IPCClient] Setting up event listener:', channel);

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
        console.log('[IPCClient] Received event data:', eventData);
        this.eventHandlers.get(channel)?.forEach((h) => {
          console.log('[IPCClient] Calling handler for channel:', channel);
          h({ service, event, data: eventData } as IPCEvent<TData>);
        });
      }
    );

    // Return cleanup function
    return () => {
      console.log('[IPCClient] Cleaning up event listener:', channel);
      this.eventHandlers.get(channel)?.delete(handler);
      if (this.eventHandlers.get(channel)?.size === 0) {
        this.eventHandlers.delete(channel);
        unsubscribe();
      }
    };
  }
}

// Export singleton instance
export const ipcClient = IPCClient.getInstance();
