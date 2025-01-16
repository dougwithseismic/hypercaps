import {
  CapsLockBehavior,
  KeyboardConfig,
  KeyboardMonitor,
  type KeyboardFrame
} from '@hypercaps/keyboard-monitor'

import { validateRemapRules } from '@hypercaps/keyboard-monitor/src/utils/remap-validator'
import { dialog } from 'electron'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { RemapperConfig } from '../../features/remapper/types'
import { store } from '../../infrastructure/store'
import {
  ErrorState,
  FrameHistoryOptions,
  KeyboardFrameEvent,
  KeyboardServiceState,
  StateChangeEvent
} from './types'

// Default configuration values
const DEFAULT_BUFFER_WINDOW = 3000 // 3 seconds
const DEFAULT_MAX_REMAP_CHAIN = 5
const DEFAULT_CAPS_BEHAVIOR: CapsLockBehavior = 'BlockToggle'
const DEFAULT_FRAME_HISTORY: FrameHistoryOptions = {
  maxSize: 100,
  retentionMs: 5000 // 5 seconds
}

const DEFAULT_KEYBOARD_SERVICE_STATE: KeyboardServiceState = {
  isListening: false,
  isLoading: false,
  isStarting: false,
  isServiceEnabled: false,
  frameHistory: [],
  historyOptions: DEFAULT_FRAME_HISTORY,
  features: {
    remapper: {
      isFeatureEnabled: false,
      config: {
        isRemapperEnabled: false,
        remaps: {},
        capsLockBehavior: DEFAULT_CAPS_BEHAVIOR
      }
    }
  }
}

export class KeyboardService extends EventEmitter {
  private static instance: KeyboardService
  private keyboardMonitor: KeyboardMonitor | null = null
  private bufferWindow = DEFAULT_BUFFER_WINDOW
  private maxRemapChainLength = DEFAULT_MAX_REMAP_CHAIN
  private state: KeyboardServiceState = DEFAULT_KEYBOARD_SERVICE_STATE
  private unsubscribeHandlers: Array<() => void> = []
  private frameCleanupInterval: NodeJS.Timeout | null = null

  private constructor() {
    super()
    this.setupStoreListeners()
    this.startFrameCleanup()
  }

  public static getInstance(): KeyboardService {
    if (!KeyboardService.instance) {
      KeyboardService.instance = new KeyboardService()
    }
    return KeyboardService.instance
  }

  private startFrameCleanup(): void {
    if (this.frameCleanupInterval) {
      clearInterval(this.frameCleanupInterval)
    }

    this.frameCleanupInterval = setInterval(() => {
      this.cleanupFrameHistory()
    }, 1000) // Check every second
  }

  private cleanupFrameHistory(): void {
    const now = Date.now()
    const { maxSize, retentionMs } = this.state.historyOptions

    let frameHistory = this.state.frameHistory.filter(
      (frame) => now - frame.timestamp < retentionMs
    )

    if (frameHistory.length > maxSize) {
      frameHistory = frameHistory.slice(-maxSize)
    }

    if (frameHistory.length !== this.state.frameHistory.length) {
      this.setState({ frameHistory })
      this.emit('keyboard:frameHistory', frameHistory)
    }
  }

  private setupStoreListeners(): void {
    // Listen for feature config changes
    const unsubscribeConfig = store.events.on('feature:config:changed', ({ feature, config }) => {
      if (feature === 'remapper') {
        this.handleConfigChange(config as RemapperConfig)
      }
    })

    // Listen for feature enable/disable
    const unsubscribeEnabled = store.events.on(
      'feature:enabled:changed',
      ({ feature, enabled }) => {
        if (feature === 'remapper') {
          this.handleFeatureToggle(enabled)
        }
      }
    )

    this.unsubscribeHandlers.push(unsubscribeConfig, unsubscribeEnabled)
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

  private validateFrame(frame: KeyboardFrame): string[] {
    const errors: string[] = []

    if (!frame.timestamp) {
      errors.push('Frame missing timestamp')
    }

    if (!frame.state) {
      errors.push('Frame missing state')
    } else {
      if (!Array.isArray(frame.state.justPressed)) {
        errors.push('Invalid justPressed state')
      }
      if (!Array.isArray(frame.state.held)) {
        errors.push('Invalid held state')
      }
      if (!Array.isArray(frame.state.justReleased)) {
        errors.push('Invalid justReleased state')
      }
      if (typeof frame.state.holdDurations !== 'object') {
        errors.push('Invalid holdDurations state')
      }
    }

    return errors
  }

  private processFrame(frame: KeyboardFrame): KeyboardFrameEvent {
    const validationErrors = this.validateFrame(frame)

    const processedFrame: KeyboardFrameEvent = {
      ...frame,
      id: randomUUID(),
      processed: true,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      state: {
        justPressed: frame.state.justPressed,
        held: frame.state.held,
        justReleased: frame.state.justReleased,
        holdDurations: frame.state.holdDurations
      }
    }

    return processedFrame
  }

  private handleKeyboardFrame = (data: KeyboardFrame): void => {
    const processedFrame = this.processFrame(data)

    // Update state
    this.setState({
      currentFrame: processedFrame,
      frameHistory: [...this.state.frameHistory, processedFrame]
    })

    // Emit frame event
    this.emit('keyboard:frame', processedFrame)

    // Handle validation errors if any
    if (processedFrame.validationErrors?.length) {
      this.emitError(
        `Frame validation errors: ${processedFrame.validationErrors.join(', ')}`,
        'FRAME_VALIDATION'
      )
    }
  }

  public async initialize(): Promise<void> {
    console.log('[KeyboardService] Initializing...')
    const remapper = store.getFeatureConfig('remapper')

    // Update initial state
    this.setState({
      isServiceEnabled: true,
      features: {
        remapper: {
          isFeatureEnabled: remapper.isFeatureEnabled,
          config: remapper.config
        }
      }
    })

    // Start if feature is enabled
    if (remapper.isFeatureEnabled) {
      await this.startListening()
    }
  }

  private validateConfig(config: RemapperConfig): boolean {
    const errors = validateRemapRules(config.remaps)

    if (errors.length > 0) {
      const errorMessages = errors.map((error) => `- ${error.message}`).join('\n')
      dialog.showErrorBox(
        'Invalid Remap Configuration',
        `The following errors were found in your remap configuration:\n\n${errorMessages}`
      )
      return false
    }

    return true
  }

  private handleConfigChange(config: RemapperConfig): void {
    console.log('[KeyboardService] Config changed:', config)

    // Validate new config before applying
    if (!this.validateConfig(config)) {
      console.error('[KeyboardService] Invalid remap configuration, not applying changes')
      return
    }

    this.restartWithConfig(config).catch((error) => {
      console.error('[KeyboardService] Failed to restart with new config:', error)
    })
  }

  private handleFeatureToggle(enabled: boolean): void {
    console.log('[KeyboardService] Feature toggled:', enabled)
    if (enabled) {
      this.startListening().catch((error) => {
        console.error('[KeyboardService] Failed to start listening:', error)
      })
    } else {
      this.stopListening().catch((error) => {
        console.error('[KeyboardService] Failed to stop listening:', error)
      })
    }
  }

  public async startListening(): Promise<void> {
    console.log('[KeyboardService] startListening() called')

    if (this.keyboardMonitor) {
      console.log('[KeyboardService] Monitor already running')
      return
    }

    const remapper = store.getFeatureConfig('remapper')
    if (!remapper.isFeatureEnabled) {
      console.log('[KeyboardService] Feature is disabled, not starting')
      return
    }

    // Validate config before starting
    if (!this.validateConfig(remapper.config)) {
      console.error('[KeyboardService] Invalid initial config, not starting')
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
      const config: KeyboardConfig = {
        // Feature flags
        isEnabled: remapper.isFeatureEnabled,
        isRemapperEnabled: remapper.config.isRemapperEnabled,

        // Remapping configuration
        remaps: remapper.config.remaps,
        maxRemapChainLength: this.maxRemapChainLength,

        // Behavior configuration
        capsLockBehavior: remapper.config.capsLockBehavior || DEFAULT_CAPS_BEHAVIOR,
        bufferWindow: this.bufferWindow
      }

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

    // Clear state but keep feature configuration
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

  public dispose(): void {
    console.log('[KeyboardService] Disposing service...')

    // Stop listening and clean up monitor
    this.stopListening()

    // Clean up resources
    this.cleanup()

    // Clean up store listeners
    this.unsubscribeHandlers.forEach((unsubscribe) => {
      try {
        unsubscribe()
      } catch (error) {
        console.error('[KeyboardService] Error during listener cleanup:', error)
      }
    })
    this.unsubscribeHandlers = []

    // Clear singleton instance
    KeyboardService.instance = undefined as unknown as KeyboardService

    console.log('[KeyboardService] Service disposed')
  }

  private async restartWithConfig(config: RemapperConfig): Promise<void> {
    await this.stopListening()
    await this.startListening()
  }

  private cleanup(): void {
    console.log('[KeyboardService] Cleaning up resources...')

    // Clear intervals
    if (this.frameCleanupInterval) {
      clearInterval(this.frameCleanupInterval)
      this.frameCleanupInterval = null
    }

    // Clear frame history and state
    this.setState({
      frameHistory: [],
      currentFrame: undefined,
      error: undefined,
      lastError: undefined,
      isListening: false,
      isLoading: false,
      isStarting: false
    })
  }
}

// Export singleton instance
export const keyboardService = KeyboardService.getInstance()
