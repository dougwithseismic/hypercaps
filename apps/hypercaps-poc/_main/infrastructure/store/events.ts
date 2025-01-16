import { AppConfig, WindowConfig } from './types';
import { Features } from './schema';

export type StoreEventType =
  | 'feature:config:changed'
  | 'feature:enabled:changed'
  | 'app:config:changed'
  | 'window:config:changed'
  | 'store:reset';

export interface StoreEventMap {
  'feature:config:changed': {
    feature: keyof Features;
    config: Features[keyof Features]['config'];
  };
  'feature:enabled:changed': {
    feature: keyof Features;
    enabled: boolean;
  };
  'app:config:changed': {
    config: Partial<AppConfig>;
  };
  'window:config:changed': {
    config: Partial<WindowConfig>;
  };
  'store:reset': undefined;
}

export type StoreEventCallback<T extends StoreEventType> = (
  payload: StoreEventMap[T]
) => void;

export class StoreEventEmitter {
  private listeners: Map<StoreEventType, Set<StoreEventCallback<any>>> =
    new Map();

  public on<T extends StoreEventType>(
    event: T,
    callback: StoreEventCallback<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event)!;
    eventListeners.add(callback);

    // Return cleanup function
    return () => {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  public emit<T extends StoreEventType>(
    event: T,
    payload: StoreEventMap[T]
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in store event listener for ${event}:`, error);
        }
      });
    }
  }

  public removeAllListeners(): void {
    this.listeners.clear();
  }
}
