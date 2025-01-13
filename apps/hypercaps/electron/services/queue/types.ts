export interface QueuedMessage<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  priority: number;
  retries: number;
  maxRetries: number;
  status: "pending" | "processing" | "completed" | "failed";
  error?: Error;
}

export interface MessageQueueOptions {
  maxConcurrent?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export type MessageHandler<T = any> = (
  message: QueuedMessage<T>
) => Promise<void>;

export interface MessageQueueEvents {
  "message:added": (message: QueuedMessage) => void;
  "message:started": (message: QueuedMessage) => void;
  "message:completed": (message: QueuedMessage) => void;
  "message:failed": (message: QueuedMessage) => void;
  "message:retrying": (message: QueuedMessage) => void;
  "queue:empty": () => void;
  "queue:error": (error: Error) => void;
}
