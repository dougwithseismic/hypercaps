/**
 * Core IPC types for service communication
 */

/**
 * Represents a command to be executed by a service
 */
export interface IPCCommand<TParams = unknown> {
  /** Service identifier */
  service: string;
  /** Action to perform */
  action: string;
  /** Optional parameters */
  params?: TParams;
}

/**
 * Result of an IPC command execution
 */
export interface IPCResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: IPCError;
}

/**
 * Standard error format for IPC operations
 */
export interface IPCError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Event emitted by a service
 */
export interface IPCEvent<TData = unknown> {
  service: string;
  event: string;
  data: TData;
}

/**
 * Handler for IPC events
 */
export type IPCEventHandler<TData = unknown> = (event: IPCEvent<TData>) => void;

/**
 * Unsubscribe function for event handlers
 */
export type IPCUnsubscribe = () => void;

/**
 * Configuration for registering a service
 */
export interface ServiceConfig {
  /** Unique service identifier */
  id: string;
  /** Optional message priority (1-5, lower is higher priority) */
  priority?: number;
  /** Optional timeout for commands in ms */
  timeout?: number;
}

/**
 * Service registration info
 */
export interface RegisteredService {
  config: ServiceConfig;
  handlers: Map<string, IPCHandler<any, any>>;
}

/**
 * Handler for executing service commands
 */
export type IPCHandler<TParams = unknown, TResult = unknown> = (
  params: TParams
) => Promise<TResult>;

/**
 * Helper to create standardized results
 */
export const createResult = <T>(data: T): IPCResult<T> => ({
  success: true,
  data,
});

/**
 * Helper to create standardized errors
 */
export const createError = (
  code: string,
  message: string,
  details?: unknown
): IPCResult => ({
  success: false,
  error: { code, message, details },
});
