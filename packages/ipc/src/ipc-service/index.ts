import { ipcMain, BrowserWindow } from "electron";
import { MessageQueue } from "@hypercaps/message-queue";
import {
  IPCCommand,
  IPCResult,
  ServiceConfig,
  RegisteredService,
  IPCHandler,
  IPCEvent,
  createError,
  createResult,
} from "../types";

/**
 * Core IPC service that handles communication between main and renderer processes
 * Uses MessageQueue internally for reliable message ordering and delivery
 */
export class IPCService {
  private static instance: IPCService;
  private services: Map<string, RegisteredService>;
  private queue: MessageQueue;
  private eventHandlers: Map<string, Map<string, Set<IPCHandler<any, any>>>>;
  private eventListeners: Set<(event: IPCEvent<any>) => void>;

  private constructor() {
    this.services = new Map();
    this.queue = MessageQueue.getInstance();
    this.eventHandlers = new Map();
    this.eventListeners = new Set();
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

    service.handlers.set(action, handler as IPCHandler<any, any>);

    // Also register as an event handler
    if (!this.eventHandlers.has(serviceId)) {
      this.eventHandlers.set(serviceId, new Map());
    }
    const serviceHandlers = this.eventHandlers.get(serviceId)!;
    if (!serviceHandlers.has(action)) {
      serviceHandlers.set(action, new Set());
    }
    serviceHandlers.get(action)!.add(handler as IPCHandler<any, any>);
  }

  /**
   * Handle an incoming command from the IPC bridge
   */
  public async handleCommand<TParams = unknown, TResult = unknown>(
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

  /**
   * Register a global event listener
   */
  public onEvent(listener: (event: IPCEvent<any>) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Create a standardized error result
   */
  public createError<T = unknown>(
    code: string,
    message: string,
    details?: unknown
  ): IPCResult<T> {
    return createError(code, message, details) as IPCResult<T>;
  }

  /**
   * Emit an event to all listeners
   */
  public emit<TData = unknown>(event: IPCEvent<TData>): void {
    // Notify all global event listeners
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[IPCService] Event listener error:", error);
      }
    });

    // Handle service-specific handlers
    const serviceHandlers = this.eventHandlers.get(event.service);
    if (serviceHandlers) {
      const handlers = serviceHandlers.get(event.event);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(event.data);
          } catch (error) {
            console.error(
              `[IPCService] Handler error for ${event.service}:${event.event}:`,
              error
            );
          }
        });
      }
    }
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
}

// Export singleton instance
export const ipc = IPCService.getInstance();
