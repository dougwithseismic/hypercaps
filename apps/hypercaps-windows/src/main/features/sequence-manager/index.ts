import { EventEmitter } from 'events'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import { sequenceStore } from './store'
import { keyboardStore } from '../../service/keyboard/store'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import { SequenceMatcher } from './sequence-matcher'
import type { InputSequence } from './types'

export interface SequenceEvents {
  'sequence:detected': {
    id: string
    sequence: InputSequence
    durationFrames: number
    startFrame: number
    endFrame: number
    timestamp: number
  }
  'sequence:failed': {
    id: string
    reason: 'timeout' | 'invalid_input' | 'wrong_order'
    failedAtStep: number
  }
  'sequence:progress': {
    id: string
    currentStep: number
    totalSteps: number
    elapsedFrames: number
  }
  'sequence:error': {
    error: Error
    sequenceId?: string
  }
}

export class SequenceManager extends EventEmitter {
  private matcher: SequenceMatcher
  private isInitialized = false
  private debugEnabled = false

  constructor() {
    super()
    this.matcher = new SequenceMatcher()
    this.handleFrame = this.handleFrame.bind(this)
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.matcher.on('sequence:complete', (event) => {
      const sequence = sequenceStore.get().sequences[event.id]
      if (!sequence) return

      if (this.debugEnabled) {
        console.log('[SequenceManager] Sequence detected:', {
          id: event.id,
          sequence,
          duration: event.duration,
          startTime: event.startTime,
          endTime: event.endTime
        })
      }

      this.emit('sequence:detected', {
        id: event.id,
        sequence,
        durationFrames: event.duration,
        startFrame: event.startTime,
        endFrame: event.endTime,
        timestamp: event.endTime
      })
    })

    this.matcher.on('sequence:failed', (event) => {
      if (this.debugEnabled) {
        console.log('[SequenceManager] Sequence failed:', {
          id: event.id,
          reason: event.reason,
          startTime: event.startTime
        })
      }

      this.emit('sequence:failed', {
        id: event.id,
        reason: event.reason,
        failedAtStep: 0 // TODO: Track step number in matcher
      })
    })
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      keyboardStore.subscribe((config) => {
        if (config.service.enabled) {
          this.matcher.setFrameRate(config.service.frameRate)
        }
      })

      sequenceStore.subscribe((config) => {
        this.debugEnabled = config.debugMode
        this.matcher.setDebug(config.debugMode)

        if (!config.isEnabled) {
          this.matcher.dispose()
          this.matcher = new SequenceMatcher()
          this.setupEventHandlers()
          this.matcher.setDebug(config.debugMode)
        } else {
          // Add all sequences to matcher
          Object.values(config.sequences).forEach((sequence) => {
            this.matcher.addSequence(sequence)
          })
        }
      })

      keyboardService.on('keyboard:frame', this.handleFrame)

      // Add initial sequences
      const config = sequenceStore.get()
      this.debugEnabled = config.debugMode
      this.matcher.setDebug(config.debugMode)
      Object.values(config.sequences).forEach((sequence) => {
        this.matcher.addSequence(sequence)
      })

      this.isInitialized = true
      console.log('[SequenceManager] Initialized successfully')
    } catch (error) {
      console.error('[SequenceManager] Initialization error:', error)
      this.emit('sequence:error', { error })
    }
  }

  private handleFrame(event: KeyboardFrameEvent): void {
    const config = sequenceStore.get()
    if (!config.isEnabled) return

    if (this.debugEnabled) {
      console.log('[SequenceManager] Received frame:', {
        frame: event.frame,
        timestamp: event.timestamp,
        held: event.state.held,
        justPressed: event.state.justPressed,
        justReleased: event.state.justReleased
      })
    }

    this.matcher.handleFrame({
      timestamp: event.timestamp,
      frameNumber: event.frame,
      heldKeys: new Set(event.state.held.map(Number)),
      justPressed: new Set(event.state.justPressed.map(Number)),
      justReleased: new Set(event.state.justReleased.map(Number))
    })
  }

  dispose(): void {
    if (this.isInitialized) {
      keyboardService.off('keyboard:frame', this.handleFrame)
      this.matcher.dispose()
      this.isInitialized = false
      this.removeAllListeners()
    }
  }
}

export const sequenceManagerFeature = new SequenceManager()
