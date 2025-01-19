import { KeyboardMonitor, type KeyboardFrame } from '@hypercaps/keyboard-monitor'
import { dialog } from 'electron'
import { EventEmitter } from 'events'
import { keyboardStore } from './store'
import { ErrorState, KeyboardFrameEvent, KeyboardServiceState, StateChangeEvent } from './types'
import { processFrame } from './utils/frame-utils'
import { createMonitorConfig } from './utils/monitor-config-utils'

export class KeyboardService extends EventEmitter {
  private static instance: KeyboardService
  private keyboardMonitor: KeyboardMonitor | null = null
  private state: KeyboardServiceState = {
    isListening: false,
    isLoading: false,
    isStarting: false,
    error: undefined,
    lastError: undefined
  }
  private config = keyboardStore.get()

  private constructor() {
    super()
    this.setupStoreListeners()
  }

  public static getInstance(): KeyboardService {
    if (!KeyboardService.instance) {
      KeyboardService.instance = new KeyboardService()
    }
    return KeyboardService.instance
  }

  private setupStoreListeners(): void {
    keyboardStore.on({
      event: 'store:changed',
      handler: ({ config }) => {
        this.config = config
        this.handleConfigChange()
      }
    })
  }

  private setState(updates: Partial<KeyboardServiceState>): void {
    const previous = { ...this.state }
    this.state = { ...this.state, ...updates }

    const stateEvent: StateChangeEvent = {
      previous,
      current: this.state,
      timestamp: Date.now()
    }

    this.emit('keyboard:state', stateEvent)
  }

  private emitError(error: Error | string, code?: string): void {
    const errorState: ErrorState = {
      message: error instanceof Error ? error.message : error,
      timestamp: Date.now(),
      code
    }

    this.setState({
      error: errorState.message,
      lastError: errorState
    })

    this.emit('keyboard:error', errorState)
  }

  public async getState(): Promise<KeyboardServiceState> {
    return this.state
  }

  public async initialize(): Promise<void> {
    console.log('[KeyboardService] Initializing...')

    if (!this.config.service.enabled) {
      console.log('[KeyboardService] Service is disabled')
      return
    }

    if (this.config.monitoring.enabled) {
      await this.startListening()
    }
  }

  public async startListening(): Promise<void> {
    console.log('[KeyboardService] startListening() called')

    if (this.keyboardMonitor) {
      console.log('[KeyboardService] Monitor already running')
      return
    }

    if (!this.config.monitoring.enabled) {
      console.log('[KeyboardService] Monitoring is disabled')
      return
    }

    this.setState({
      isLoading: true,
      isStarting: true,
      error: undefined,
      lastError: undefined,
      isListening: false
    })

    try {
      const config = createMonitorConfig(this.config)
      console.log('KeyboardMonitor config:', config)

      this.keyboardMonitor = new KeyboardMonitor((eventName: string, data: KeyboardFrame) => {
        if (eventName === 'frame') {
          this.handleKeyboardFrame(data)
        }
      })

      this.keyboardMonitor.setConfig(config)
      this.keyboardMonitor.start()

      this.setState({
        isListening: true,
        isLoading: false,
        isStarting: false
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during startup'
      this.setState({
        isStarting: false,
        error: errorMessage,
        lastError: {
          message: errorMessage,
          timestamp: Date.now()
        }
      })
      dialog.showErrorBox(
        'Keyboard Monitor Error',
        `Failed to start keyboard monitor: ${errorMessage}`
      )
    }
  }

  public async stopListening(): Promise<void> {
    console.log('[KeyboardService] stopListening() called')

    if (this.keyboardMonitor) {
      this.keyboardMonitor.stop()
      this.keyboardMonitor = null
    }

    this.setState({
      isListening: false,
      isLoading: false,
      error: undefined
    })

    console.log('[KeyboardService] Service stopped')
  }

  public isRunning(): boolean {
    return this.keyboardMonitor !== null && this.state.isListening
  }

  private handleConfigChange(): void {
    console.log('[KeyboardService] Config changed:', this.config)

    if (!this.config.service.enabled) {
      this.stopListening()
      return
    }

    if (this.config.monitoring.enabled && !this.isRunning()) {
      this.startListening()
    } else if (!this.config.monitoring.enabled && this.isRunning()) {
      this.stopListening()
    } else if (this.isRunning()) {
      // Update monitor config
      this.updateMonitorConfig()
    }
  }

  private updateMonitorConfig(): void {
    if (!this.keyboardMonitor) return
    const config = createMonitorConfig(this.config)
    this.keyboardMonitor.setConfig(config)
  }

  private handleKeyboardFrame = (data: KeyboardFrame): void => {
    const processedFrame = processFrame(data)
    this.emit('keyboard:frame', processedFrame)
    // Handle validation errors if any
    if (processedFrame.validationErrors?.length) {
      this.emitError(
        `Frame validation errors: ${processedFrame.validationErrors.join(', ')}`,
        'FRAME_VALIDATION'
      )
    }
  }

  public dispose(): void {
    console.log('[KeyboardService] Disposing service...')
    this.stopListening()
    KeyboardService.instance = undefined as unknown as KeyboardService
    console.log('[KeyboardService] Service disposed')
  }
}

// Export singleton instance
export const keyboardService = KeyboardService.getInstance()
