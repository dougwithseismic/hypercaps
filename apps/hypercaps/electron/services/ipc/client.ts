import { ipcRenderer } from "electron";
import type {
  IPCCommand,
  IPCResult,
  IPCEvent,
  IPCEventHandler,
  IPCUnsubscribe,
  IPCError,
} from "./types";

/**
 * Client-side IPC service for communicating with the main process
 * Provides a clean API for running commands and subscribing to events
 */
class IPCClient {
  private static instance: IPCClient;

  private constructor() {
    // Private constructor for singleton
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
    const result = (await ipcRenderer.invoke(
      "ipc:command",
      command
    )) as IPCResult<TResult>;

    if (!result.success) {
      throw new Error(result.error?.message || "Unknown error");
    }

    return result.data as TResult;
  }

  /**
   * Subscribe to events from a service
   */
  public on<TData = unknown>(
    service: string,
    event: string,
    handler: IPCEventHandler<TData>
  ): IPCUnsubscribe {
    const channel = `${service}:${event}`;
    const listener = (_: unknown, ipcEvent: IPCEvent<TData>) =>
      handler(ipcEvent);

    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
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
