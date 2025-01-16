import Store from 'electron-store'
import { EventEmitter } from 'events'
import { app } from 'electron'
import path from 'path'
import { produce } from 'immer'
import { z } from 'zod'

/**
 * Base store events that all stores will have
 */
interface BaseStoreEvents<T> {
  'store:changed': { config: T }
  'store:error': { error: Error }
  'store:reset': undefined
}

/**
 * Store configuration options
 */
interface StoreOptions<T> {
  /** Unique name for the store (used as filename) */
  name: string
  /** Zod schema for validation */
  schema: z.ZodType<T>
  /** Default configuration */
  defaultConfig: T
  /** Custom storage location (optional) */
  cwd?: string
}

/**
 * Update request object
 */
interface UpdateRequest<T> {
  /** Updater function using Immer */
  update: (config: T) => void
}

/**
 * Set request object
 */
interface SetRequest<T> {
  /** Partial config to merge */
  config: Partial<T>
}

/**
 * Event subscription request
 */
interface OnRequest<T, K extends keyof T> {
  /** Event name */
  event: K
  /** Event handler */
  handler: (payload: T[K]) => void
}

/**
 * Event emission request
 */
interface EmitRequest<T, K extends keyof T> {
  /** Event name */
  event: K
  /** Event payload */
  payload: T[K]
}

/**
 * Type-safe store with events and Immer integration
 * @example
 * ```typescript
 * // 1. Define your schema and events
 * const configSchema = z.object({
 *   isEnabled: z.boolean(),
 *   items: z.array(z.string())
 * })
 *
 * interface MyEvents extends BaseStoreEvents<MyConfig> {
 *   'item:added': { item: string }
 *   'item:removed': { item: string }
 * }
 *
 * // 2. Create store instance
 * const myStore = createStore({
 *   name: 'my-feature',
 *   schema: configSchema,
 *   defaultConfig: { isEnabled: false, items: [] }
 * })
 *
 * // 3. Type-safe events
 * myStore.on({
 *   event: 'item:added',
 *   handler: ({ item }) => console.log('Item added:', item)
 * })
 *
 * // 4. Update and emit
 * myStore.update({
 *   update: config => {
 *     config.items.push('new item')
 *   }
 * })
 * ```
 */
export class TypedStore<
  T extends Record<string, any>,
  Events extends BaseStoreEvents<T> = BaseStoreEvents<T>
> {
  private store: Store<T>
  private emitter: EventEmitter

  constructor(options: StoreOptions<T>) {
    this.emitter = new EventEmitter()

    this.store = new Store<T>({
      name: options.name,
      defaults: options.defaultConfig,
      cwd:
        options.cwd ??
        (process.env.NODE_ENV === 'development'
          ? process.cwd()
          : path.join(app.getPath('appData'), 'hypercaps'))
    })

    // Validate initial config
    try {
      const config = this.store.store
      options.schema.parse(config)
    } catch (error) {
      console.error(`Invalid config for ${options.name}:`, error)
      this.store.set(options.defaultConfig)
    }
  }

  /**
   * Get current config
   */
  get(): T {
    return this.store.store
  }

  /**
   * Update config using Immer
   */
  update(request: UpdateRequest<T>): void {
    try {
      const nextConfig = produce(this.get(), request.update)
      this.store.set(nextConfig)
      this.emit({
        event: 'store:changed',
        payload: { config: nextConfig }
      })
    } catch (error) {
      this.emit({
        event: 'store:error',
        payload: { error: error as Error }
      })
    }
  }

  /**
   * Set config directly
   */
  set(request: SetRequest<T>): void {
    try {
      const nextConfig = {
        ...this.get(),
        ...request.config
      }
      this.store.set(nextConfig)
      this.emit({
        event: 'store:changed',
        payload: { config: nextConfig }
      })
    } catch (error) {
      this.emit({
        event: 'store:error',
        payload: { error: error as Error }
      })
    }
  }

  /**
   * Subscribe to store events with type safety
   */
  on<K extends keyof Events>(request: OnRequest<Events, K>): () => void {
    const handler = (payload: Events[K]) => request.handler(payload)
    this.emitter.on(request.event as string, handler)
    return () => this.emitter.off(request.event as string, handler)
  }

  /**
   * Emit store events with type safety
   */
  private emit<K extends keyof Events>(request: EmitRequest<Events, K>): boolean {
    return this.emitter.emit(request.event as string, request.payload)
  }

  /**
   * Subscribe to all config changes
   */
  subscribe(handler: (config: T) => void): () => void {
    return this.on({
      event: 'store:changed',
      handler: ({ config }) => handler(config)
    })
  }

  /**
   * Reset store to defaults
   */
  reset(): void {
    this.store.clear()
    this.emit({
      event: 'store:reset',
      payload: undefined
    })
  }
}

/**
 * Creates a type-safe store instance
 * @example
 * ```typescript
 * // 1. Define schema and events
 * const configSchema = z.object({
 *   isEnabled: z.boolean(),
 *   items: z.array(z.string())
 * })
 *
 * interface MyEvents extends BaseStoreEvents<MyConfig> {
 *   'item:added': { item: string }
 *   'item:removed': { item: string }
 * }
 *
 * // 2. Create store with events
 * const store = createStore({
 *   name: 'my-feature',
 *   schema: configSchema,
 *   defaultConfig: { isEnabled: false, items: [] }
 * })
 *
 * // 3. Type-safe usage
 * store.on({
 *   event: 'item:added',
 *   handler: ({ item }) => console.log('Added:', item)
 * })
 *
 * store.update({
 *   update: config => {
 *     config.items.push('new')
 *   }
 * })
 * ```
 */
export function createStore<
  T extends Record<string, any>,
  Events extends BaseStoreEvents<T> = BaseStoreEvents<T>
>(options: StoreOptions<T>): TypedStore<T, Events> {
  return new TypedStore(options)
}
