/**
 * MessageQueue Service
 *
 * Handles real-time event processing and transient state management.
 * This service is separate from the Store service, which handles persistent configuration.
 *
 * Key responsibilities:
 * 1. Real-time event ordering (keyboard events, state updates)
 * 2. Transient state management (service status, current key states)
 * 3. Immediate state propagation to renderer
 *
 * This queue ensures:
 * - Events are processed in order with priority
 * - State updates are atomic and consistent
 * - Failed operations can be retried
 * - Resource cleanup happens properly
 *
 * @note This is NOT for persistent storage - use Store service for that
 */

import { EventEmitter } from "events";
import crypto from "crypto";
import {
  QueuedMessage,
  MessageQueueOptions,
  MessageHandler,
  MessageQueueEvents,
} from "./types";

const DEFAULT_OPTIONS: Required<MessageQueueOptions> = {
  maxConcurrent: 1,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
};

function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export class MessageQueue extends EventEmitter {
  private static instance: MessageQueue;
  private messages: QueuedMessage<unknown>[] = [];
  private processing: Set<string> = new Set();
  private handlers: Map<string, MessageHandler<unknown>> = new Map();
  private options: Required<MessageQueueOptions>;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  private constructor(options: MessageQueueOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Singleton instance ensures all events go through the same queue
   * This is critical for maintaining event order and state consistency
   */
  public static getInstance(options?: MessageQueueOptions): MessageQueue {
    if (!MessageQueue.instance) {
      MessageQueue.instance = new MessageQueue(options);
    }
    return MessageQueue.instance;
  }

  /**
   * Register a handler for a specific message type
   * Handlers should be fast and only handle transient state
   * For persistent changes, handlers should delegate to Store service
   */
  public registerHandler<T>(type: string, handler: MessageHandler<T>): void {
    this.handlers.set(type, handler as MessageHandler<unknown>);
  }

  /**
   * Enqueue a message for processing
   * Higher priority messages jump the queue but maintain order within their priority level
   * @param type Message type that maps to a registered handler
   * @param payload Data to be processed
   * @param priority Higher numbers = higher priority (default 0)
   * @returns Message ID for tracking
   */
  public async enqueue<T>(
    type: string,
    payload: T,
    priority = 0,
  ): Promise<string> {
    const message: QueuedMessage<T> = {
      id: generateId(),
      type,
      payload,
      timestamp: Date.now(),
      priority,
      retries: 0,
      maxRetries: this.options.maxRetries,
      status: "pending",
    };

    this.messages.push(message);
    this.messages.sort(
      (a, b) => b.priority - a.priority || a.timestamp - b.timestamp,
    );

    this.emit("message:added", message);
    this.processQueue();

    return message.id;
  }

  private async processQueue(): Promise<void> {
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    const pendingMessages = this.messages.filter(
      (m) => m.status === "pending" && !this.processing.has(m.id),
    );

    if (pendingMessages.length === 0) {
      if (this.processing.size === 0) {
        this.emit("queue:empty");
      }
      return;
    }

    const message = pendingMessages[0];
    if (!message) {
      return;
    }

    const handler = this.handlers.get(message.type);

    if (!handler) {
      message.status = "failed";
      message.error = new Error(
        `No handler registered for message type: ${message.type}`,
      );
      this.emit("message:failed", message);
      return;
    }

    this.processing.add(message.id);
    message.status = "processing";
    this.emit("message:started", message);

    // Set timeout
    const timeout = setTimeout(() => {
      this.handleTimeout(message);
    }, this.options.timeout);
    this.timeouts.set(message.id, timeout);

    try {
      await handler(message);
      this.handleSuccess(message);
    } catch (error) {
      this.handleError(
        message,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private handleSuccess(message: QueuedMessage<unknown>): void {
    this.clearTimeout(message.id);
    this.processing.delete(message.id);
    message.status = "completed";
    this.emit("message:completed", message);
    this.messages = this.messages.filter((m) => m.id !== message.id);
    this.processQueue();
  }

  private handleError(message: QueuedMessage<unknown>, error: Error): void {
    this.clearTimeout(message.id);
    this.processing.delete(message.id);
    message.error = error;

    if (message.retries < message.maxRetries) {
      message.retries++;
      message.status = "pending";
      this.emit("message:retrying", message);
      setTimeout(() => this.processQueue(), this.options.retryDelay);
    } else {
      message.status = "failed";
      this.emit("message:failed", message);
      this.messages = this.messages.filter((m) => m.id !== message.id);
      this.processQueue();
    }
  }

  private handleTimeout(message: QueuedMessage<unknown>): void {
    this.processing.delete(message.id);
    message.error = new Error(
      `Message processing timed out after ${this.options.timeout}ms`,
    );
    this.handleError(message, message.error);
  }

  private clearTimeout(messageId: string): void {
    const timeout = this.timeouts.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(messageId);
    }
  }

  public getQueueStatus(): {
    pending: number;
    processing: number;
    total: number;
  } {
    return {
      pending: this.messages.filter((m) => m.status === "pending").length,
      processing: this.processing.size,
      total: this.messages.length,
    };
  }

  public clearQueue(): void {
    this.messages = [];
    this.processing.clear();
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts.clear();
  }

  public on<K extends keyof MessageQueueEvents>(
    event: K,
    listener: MessageQueueEvents[K],
  ): this {
    return super.on(event, listener);
  }

  public emit<K extends keyof MessageQueueEvents>(
    event: K,
    ...args: Parameters<MessageQueueEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

export const messageQueue = MessageQueue.getInstance();
