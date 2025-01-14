import { ipcMain, BrowserWindow } from "electron";
import { MessageQueue } from "../queue";
import {
  IPCCommand,
  IPCResult,
  ServiceConfig,
  RegisteredService,
  IPCHandler,
  IPCEvent,
  createError,
  createResult,
} from "./types";

/**
 * Core IPC service that handles communication between main and renderer processes
 * Uses MessageQueue internally for reliable message ordering and delivery
 */
export class IPCService {
  private static instance: IPCService;
  private services: Map<string, RegisteredService>;
  private queue: MessageQueue;
  private eventHandlers: Map<string, Map<string, Set<IPCHandler>>>;

  private constructor() {
    this.services = new Map();
    this.queue = MessageQueue.getInstance();
    this.eventHandlers = new Map();
    this.setupIPC();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): IPCService {
    if (!IPCService.instance) {
      IPCService.instance = new IPCService();
    }
    return IPCService.instance;
  }

  /**
   * Register a service with the IPC system
   */
  public registerService(config: ServiceConfig): RegisteredService {
    if (this.services.has(config.id)) {
      throw new Error(`Service ${config.id} is already registered`);
    }

    const service: RegisteredService = {
      config,
      handlers: new Map(),
    };

    this.services.set(config.id, service);
    return service;
  }

  /**
   * Register a handler for a specific service action
   */
  public registerHandler<TParams = unknown, TResult = unknown>(
    serviceId: string,
    action: string,
    handler: IPCHandler<TParams, TResult>
  ): void {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    service.handlers.set(action, handler);

    // Also register as an event handler
    if (!this.eventHandlers.has(serviceId)) {
      this.eventHandlers.set(serviceId, new Map());
    }
    const serviceHandlers = this.eventHandlers.get(serviceId)!;
    if (!serviceHandlers.has(action)) {
      serviceHandlers.set(action, new Set());
    }
    serviceHandlers.get(action)!.add(handler as IPCHandler);
  }

  /**
   * Emit an event to all renderer processes and main process handlers
   */
  public emit<TData = unknown>(event: IPCEvent<TData>): void {
    console.log("[IPCService] Emitting event:", event);
    // Queue the event emission to maintain ordering
    this.queue.enqueue(
      "ipc:event",
      async () => {
        console.log("[IPCService] Processing queued event:", event);

        // Send to browser windows
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((window) => {
          console.log("[IPCService] Sending event to window:", window.id);
          window.webContents.send("ipc:event", event);
        });

        // Send to main process handlers
        const serviceHandlers = this.eventHandlers.get(event.service);
        if (serviceHandlers) {
          const handlers = serviceHandlers.get(event.event);
          if (handlers) {
            console.log(
              `[IPCService] Found ${handlers.size} handlers for ${event.service}:${event.event}`
            );
            for (const handler of handlers) {
              try {
                await handler(event.data);
              } catch (error) {
                console.error(
                  `[IPCService] Handler error for ${event.service}:${event.event}:`,
                  error
                );
              }
            }
          }
        }
      },
      1
    ); // High priority for events
  }

  /**
   * Unregister a service
   */
  public unregisterService(serviceId: string): void {
    this.services.delete(serviceId);
    this.eventHandlers.delete(serviceId);
  }

  /**
   * Set up IPC listeners
   */
  private setupIPC(): void {
    // Handle incoming commands
    ipcMain.handle("ipc:command", async (_, command: IPCCommand) => {
      try {
        return await this.handleCommand(command);
      } catch (error) {
        return createError(
          "COMMAND_ERROR",
          error instanceof Error ? error.message : "Unknown error",
          error
        );
      }
    });

    // Register queue handler for events
    this.queue.registerHandler("ipc:event", async (message) => {
      const event = message.payload as () => Promise<void>;
      await event();
    });

    // Register queue handler for command execution
    this.queue.registerHandler<() => Promise<unknown>>(
      "ipc:execute",
      async (message) => {
        const handler = message.payload;
        await handler();
      }
    );
  }

  /**
   * Handle an incoming command
   */
  private async handleCommand<TParams = unknown, TResult = unknown>(
    command: IPCCommand<TParams>
  ): Promise<IPCResult<TResult>> {
    const service = this.services.get(command.service);
    if (!service) {
      return createError(
        "SERVICE_NOT_FOUND",
        `Service ${command.service} not found`
      ) as IPCResult<TResult>;
    }

    const handler = service.handlers.get(command.action) as IPCHandler<
      TParams,
      TResult
    >;
    if (!handler) {
      return createError(
        "HANDLER_NOT_FOUND",
        `Handler for ${command.service}:${command.action} not found`
      ) as IPCResult<TResult>;
    }

    try {
      // Execute handler directly instead of using queue
      const result = await handler(command.params || ({} as TParams));
      return createResult(result) as IPCResult<TResult>;
    } catch (error) {
      return createError(
        "EXECUTION_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        error
      ) as IPCResult<TResult>;
    }
  }
}

// Export singleton instance
export const ipc = IPCService.getInstance();
