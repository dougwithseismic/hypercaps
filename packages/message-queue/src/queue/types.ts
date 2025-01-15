export interface QueuedMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  priority: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: Error;
}

export interface MessageQueueOptions {
  maxConcurrent?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export type MessageHandler<T = unknown> = (
  message: QueuedMessage<T>
) => Promise<void>;

export interface MessageQueueEvents {
  'message:added': (message: QueuedMessage<unknown>) => void;
  'message:started': (message: QueuedMessage<unknown>) => void;
  'message:completed': (message: QueuedMessage<unknown>) => void;
  'message:failed': (message: QueuedMessage<unknown>) => void;
  'message:retrying': (message: QueuedMessage<unknown>) => void;
  'queue:empty': () => void;
  'queue:error': (error: Error) => void;
}
