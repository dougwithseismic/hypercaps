import { EventEmitter } from 'events'
import type {
  KeyboardFrame,
  InputSequence,
  SequenceState,
  PendingMatch,
  StepMatchResult,
  ChordStep,
  SequenceStep,
  HoldStep
} from './types'
import { sequenceStore, sequenceManager } from './store'
import { keyboardStore } from '../../service/keyboard/store'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'

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
  private activeStates = new Map<string, SequenceState>()
  private pendingMatches = new Map<string, PendingMatch>()
  private frameBuffer: KeyboardFrame[] = []
  private isInitialized = false
  private debugEnabled = false

  constructor() {
    super()
    this.handleFrame = this.handleFrame.bind(this)
  }

  /**
   * Initialize the sequence manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Subscribe to keyboard store changes
      keyboardStore.subscribe((config) => {
        if (config.service.enabled) {
          sequenceManager.setFrameRate(config.service.frameRate)
          sequenceManager.setBufferSize(config.service.frameBufferSize)
        }
      })

      // Subscribe to sequence store changes
      sequenceStore.subscribe((config) => {
        this.debugEnabled = config.debugMode
        if (!config.isEnabled) {
          this.reset()
        }
      })

      // Subscribe to keyboard frames
      keyboardService.on('keyboard:frame', this.handleFrame)

      // Initialize frame buffer
      const config = sequenceStore.get()
      this.debugEnabled = config.debugMode
      this.frameBuffer = new Array(config.bufferSize).fill({
        timestamp: 0,
        frameNumber: 0,
        heldKeys: new Set(),
        justPressed: new Set(),
        justReleased: new Set()
      })

      this.isInitialized = true
      console.log('[SequenceManager] Initialized successfully')
    } catch (error) {
      console.error('[SequenceManager] Initialization error:', error)
      this.emit('sequence:error', { error })
    }
  }

  /**
   * Handle a new keyboard frame
   */
  private handleFrame = (event: KeyboardFrameEvent): void => {
    const config = sequenceStore.get()
    if (!config.isEnabled) {
      return
    }

    const frame: KeyboardFrame = {
      timestamp: event.timestamp,
      frameNumber: event.frame,
      heldKeys: new Set(event.state.held.map(Number)),
      justPressed: new Set(event.state.justPressed.map(Number)),
      justReleased: new Set(event.state.justReleased.map(Number))
    }

    // Update frame buffer
    this.frameBuffer.push(frame)
    if (this.frameBuffer.length > config.bufferSize) {
      this.frameBuffer.shift()
    }

    // Process active sequences
    this.processActiveSequences(frame)

    // Check for new sequence starts
    this.checkNewSequences(frame)

    // Clean up expired states and matches
    this.cleanup(frame.timestamp)
  }

  /**
   * Process active sequences
   */
  private processActiveSequences(frame: KeyboardFrame): void {
    for (const [id, state] of this.activeStates) {
      const sequence = sequenceStore.get().sequences[id]
      if (!sequence) {
        this.activeStates.delete(id)
        continue
      }

      // Update elapsed frames
      state.elapsedFrames++

      // Check for timeout
      if (state.elapsedFrames > sequence.timeoutFrames) {
        this.handleSequenceFailed(id, state, 'timeout')
        continue
      }

      // Process current step
      const currentStep = sequence.steps[state.currentStep]
      const result = this.evaluateStep(currentStep, frame, state)

      if (this.debugEnabled) {
        // console.log(`[SequenceManager] Processing sequence "${id}":`, {
        //   step: state.currentStep + 1,
        //   totalSteps: sequence.steps.length,
        //   stepType: currentStep.type,
        //   isMatch: result.isMatch,
        //   isComplete: result.isComplete,
        //   matchedKeys: Array.from(result.matchedKeys),
        //   confidence: state.confidence,
        //   elapsedFrames: state.elapsedFrames,
        //   currentKeys: {
        //     justPressed: Array.from(frame.justPressed),
        //     heldKeys: Array.from(frame.heldKeys)
        //   }
        // })
      }

      // Update state with new matched keys
      state.matchedKeys = result.matchedKeys

      if (result.isComplete) {
        // Move to next step or complete sequence
        if (state.currentStep === sequence.steps.length - 1) {
          this.handleSequenceComplete(id, state, frame)
        } else {
          state.currentStep++
          // Initialize new step's pressed keys tracking
          state.pressedKeysPerStep.set(state.currentStep, new Set())
          // Reset matched keys for next step
          state.matchedKeys = new Set()
          this.emitProgress(id, state)
        }
      } else if (!result.isMatch && sequence.strictOrder) {
        // Only fail if we actually pressed wrong keys
        if (frame.justPressed.size > 0) {
          this.handleSequenceFailed(id, state, 'wrong_order')
        }
      }
    }
  }

  /**
   * Check for new sequences starting
   */
  private checkNewSequences(frame: KeyboardFrame): void {
    const config = sequenceStore.get()
    if (this.activeStates.size >= config.maxActiveSequences) {
      return
    }

    // Check each sequence for potential start
    for (const [id, sequence] of Object.entries(config.sequences)) {
      // Skip if sequence is active or in cooldown
      if (this.activeStates.has(id) || this.pendingMatches.has(id)) {
        if (this.debugEnabled) {
          console.log(`[SequenceManager] Skipping sequence "${id}":`, {
            reason: this.activeStates.has(id) ? 'already active' : 'in cooldown',
            cooldownRemaining: this.pendingMatches.get(id)?.expiresAt
              ? Math.max(0, this.pendingMatches.get(id)!.expiresAt - frame.timestamp)
              : 0
          })
        }
        continue
      }

      const firstStep = sequence.steps[0]

      // Only evaluate if we've pressed a key that's actually in the first step
      const pressedKeys = Array.from(frame.justPressed)
      const relevantKeyPressed = pressedKeys.some((key) => {
        switch (firstStep.type) {
          case 'CHORD':
            return firstStep.keys.includes(key)
          case 'SEQUENCE':
            // For sequences, only the first key matters
            return firstStep.keys[0] === key
          case 'HOLD':
            // For hold steps, we need either a hold key or press key
            return firstStep.holdKeys.includes(key) || firstStep.pressKeys.includes(key)
          default:
            return false
        }
      })

      if (!relevantKeyPressed) {
        // if (this.debugEnabled) {
        //   console.log(`[SequenceManager] Ignoring sequence "${id}" - no relevant keys pressed:`, {
        //     pressedKeys,
        //     stepType: firstStep.type,
        //     requiredKeys:
        //       firstStep.type === 'HOLD'
        //         ? { holdKeys: firstStep.holdKeys, pressKeys: firstStep.pressKeys }
        //         : firstStep.keys
        //   })
        // }
        continue
      }

      const result = this.evaluateStep(firstStep, frame, {
        id,
        currentStep: 0,
        startFrame: frame.frameNumber,
        elapsedFrames: 0,
        matchedKeys: new Set(),
        confidence: 0,
        pressedKeysPerStep: new Map()
      })

      if (result.isMatch) {
        // Start tracking this sequence
        const newState = {
          id,
          currentStep: result.isComplete ? 1 : 0,
          startFrame: frame.frameNumber,
          elapsedFrames: 0,
          matchedKeys: result.matchedKeys,
          confidence: result.timingScore * 100,
          pressedKeysPerStep: new Map([[0, new Set(frame.justPressed)]])
        }
        this.activeStates.set(id, newState)

        if (this.debugEnabled) {
          console.log(`[SequenceManager] Started new sequence "${id}":`, {
            stepType: firstStep.type,
            isComplete: result.isComplete,
            matchedKeys: Array.from(result.matchedKeys),
            confidence: newState.confidence,
            pressedKeys: Array.from(frame.justPressed)
          })
        }
      }
    }
  }

  /**
   * Clean up expired states and matches
   */
  private cleanup(timestamp: number): void {
    // Clean up pending matches
    for (const [id, match] of this.pendingMatches) {
      if (timestamp >= match.expiresAt) {
        this.pendingMatches.delete(id)
      }
    }

    // Clean up expired states
    for (const [id, state] of this.activeStates) {
      const sequence = sequenceStore.get().sequences[id]
      if (!sequence || state.elapsedFrames > sequence.timeoutFrames) {
        this.activeStates.delete(id)
      }
    }
  }

  /**
   * Handle sequence completion
   */
  private handleSequenceComplete(id: string, state: SequenceState, frame: KeyboardFrame): void {
    const sequence = sequenceStore.get().sequences[id]
    const config = sequenceStore.get()

    if (this.debugEnabled) {
      console.log(`
      ███████╗███████╗ ██████╗ ██╗   ██╗███████╗███╗   ██╗ ██████╗███████╗
      ██╔════╝██╔════╝██╔═══██╗██║   ██║██╔════╝████╗  ██║██╔════╝██╔════╝
      ███████╗█████╗  ██║   ██║██║   ██║█████╗  ██╔██╗ ██║██║     █████╗  
      ╚════██║██╔══╝  ██║▄▄ ██║██║   ██║██╔══╝  ██║╚██╗██║██║     ██╔══╝  
      ███████║███████╗╚██████╔╝╚██████╔╝███████╗██║ ╚████║╚██████╗███████╗
      ╚══════╝╚══════╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
      `)
      console.log(`[SequenceManager] Sequence "${id}" completed successfully:`, {
        durationFrames: state.elapsedFrames,
        confidence: state.confidence,
        matchedKeys: Array.from(state.matchedKeys),
        pressedKeysPerStep: Array.from(state.pressedKeysPerStep.entries()).map(([step, keys]) => ({
          step: step + 1,
          keys: Array.from(keys)
        })),
        otherActiveSequences: Array.from(this.activeStates.keys()).filter((s) => s !== id),
        cooldownMs: config.cooldownMs
      })
    }

    // Get all keys used in the sequence
    const usedKeys = new Set<number>()
    sequence.steps.forEach((step) => {
      switch (step.type) {
        case 'CHORD':
          step.keys.forEach((k) => usedKeys.add(k))
          break
        case 'SEQUENCE':
          step.keys.forEach((k) => usedKeys.add(k))
          break
        case 'HOLD':
          step.holdKeys.forEach((k) => usedKeys.add(k))
          step.pressKeys.forEach((k) => usedKeys.add(k))
          break
      }
    })

    // Add a cooldown for this sequence using config
    this.pendingMatches.set(id, {
      sequenceId: id,
      state,
      expiresAt: frame.timestamp + config.cooldownMs,
      priority: 0
    })

    // Clear frame buffer of used keys
    this.frameBuffer = this.frameBuffer.map((f) => ({
      ...f,
      heldKeys: new Set([...f.heldKeys].filter((k) => !usedKeys.has(k))),
      justPressed: new Set([...f.justPressed].filter((k) => !usedKeys.has(k))),
      justReleased: new Set([...f.justReleased].filter((k) => !usedKeys.has(k)))
    }))

    this.emit('sequence:detected', {
      id,
      sequence,
      durationFrames: state.elapsedFrames,
      startFrame: state.startFrame,
      endFrame: frame.frameNumber,
      timestamp: frame.timestamp
    })

    this.activeStates.delete(id)
  }

  /**
   * Handle sequence failure
   */
  private handleSequenceFailed(
    id: string,
    state: SequenceState,
    reason: 'timeout' | 'invalid_input' | 'wrong_order'
  ): void {
    if (this.debugEnabled) {
      console.log(`[SequenceManager] Sequence "${id}" failed:`, {
        reason,
        step: state.currentStep + 1,
        elapsedFrames: state.elapsedFrames,
        matchedKeys: Array.from(state.matchedKeys)
      })
    }

    this.emit('sequence:failed', {
      id,
      reason,
      failedAtStep: state.currentStep
    })

    this.activeStates.delete(id)
  }

  /**
   * Emit sequence progress
   */
  private emitProgress(id: string, state: SequenceState): void {
    const sequence = sequenceStore.get().sequences[id]

    if (this.debugEnabled) {
      console.log(`[SequenceManager] Sequence "${id}" progress:`, {
        step: state.currentStep + 1,
        totalSteps: sequence.steps.length,
        elapsedFrames: state.elapsedFrames,
        confidence: state.confidence
      })
    }

    this.emit('sequence:progress', {
      id,
      currentStep: state.currentStep,
      totalSteps: sequence.steps.length,
      elapsedFrames: state.elapsedFrames
    })
  }

  /**
   * Reset all state
   */
  private reset(): void {
    this.activeStates.clear()
    this.pendingMatches.clear()
    this.frameBuffer = []
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.isInitialized) {
      keyboardService.off('keyboard:frame', this.handleFrame)
      this.reset()
      this.isInitialized = false
      this.removeAllListeners()
    }
  }

  /**
   * Evaluate a single step
   */
  private evaluateStep(
    step: InputSequence['steps'][number],
    frame: KeyboardFrame,
    state: SequenceState
  ): StepMatchResult {
    switch (step.type) {
      case 'CHORD':
        return this.evaluateChordStep(step, frame)
      case 'SEQUENCE':
        return this.evaluateSequenceStep(step, frame, state)
      case 'HOLD':
        return this.evaluateHoldStep(step, frame, state)
      default:
        return { isMatch: false, isComplete: false, matchedKeys: new Set(), timingScore: 0 }
    }
  }

  /**
   * Evaluate a chord step
   */
  private evaluateChordStep(step: ChordStep, frame: KeyboardFrame): StepMatchResult {
    const config = sequenceStore.get()
    const tolerance = step.toleranceFrames ?? config.chordTolerance
    const matchedKeys = new Set<number>()

    // Check if all required keys are either just pressed or held
    for (const key of step.keys) {
      if (frame.justPressed.has(key) || frame.heldKeys.has(key)) {
        matchedKeys.add(key)
      }
    }

    const isMatch = matchedKeys.size === step.keys.length
    const timingScore = isMatch ? this.calculateTimingScore(frame, tolerance) : 0

    // For chords, we're either complete or not matching at all
    return {
      isMatch,
      isComplete: isMatch,
      matchedKeys,
      timingScore
    }
  }

  /**
   * Evaluate a sequence step
   */
  private evaluateSequenceStep(
    step: SequenceStep,
    frame: KeyboardFrame,
    state: SequenceState
  ): StepMatchResult {
    const matchedKeys = new Set(state.matchedKeys) // Start with existing matched keys
    let isMatch = false
    let isComplete = false

    // Get the next required key in sequence
    const nextKey = step.keys[matchedKeys.size]

    if (nextKey) {
      // Check if the next key is pressed
      if (frame.justPressed.has(nextKey)) {
        matchedKeys.add(nextKey)
        isMatch = true

        // Check if sequence is complete
        isComplete = matchedKeys.size === step.keys.length
      } else if (!step.allowExtraInputs && frame.justPressed.size > 0) {
        // If we don't allow extra inputs and pressed something wrong, fail immediately
        isMatch = false
      } else {
        // No new keys pressed, maintain current state
        isMatch = matchedKeys.size > 0
      }

      if (this.debugEnabled && frame.justPressed.size > 0) {
        console.log(`[SequenceManager] Sequence step evaluation:`, {
          nextExpectedKey: nextKey,
          pressedKeys: Array.from(frame.justPressed),
          currentMatched: Array.from(matchedKeys),
          isMatch,
          isComplete,
          allowExtraInputs: step.allowExtraInputs
        })
      }
    }

    const timingScore = isMatch ? this.calculateTimingScore(frame, step.maxFrameGap) : 0

    return {
      isMatch,
      isComplete,
      matchedKeys,
      timingScore
    }
  }

  /**
   * Evaluate a hold step
   */
  private evaluateHoldStep(
    step: HoldStep,
    frame: KeyboardFrame,
    state: SequenceState
  ): StepMatchResult {
    const matchedKeys = new Set<number>()
    let isMatch = false
    let isComplete = false

    // Get or create the set of pressed keys for this step
    if (!state.pressedKeysPerStep.has(state.currentStep)) {
      state.pressedKeysPerStep.set(state.currentStep, new Set())
    }
    const stepPressedKeys = state.pressedKeysPerStep.get(state.currentStep)!

    // Check if all hold keys are held
    const allHoldKeysHeld = step.holdKeys.every((key) => frame.heldKeys.has(key))
    if (allHoldKeysHeld) {
      // Add hold keys to matched keys
      step.holdKeys.forEach((key) => matchedKeys.add(key))

      // Check if we've held long enough
      if (state.elapsedFrames >= step.minHoldFrames) {
        // Check if press keys are pressed AND haven't been used in this step
        const newPressKeys = step.pressKeys.filter(
          (key) => frame.justPressed.has(key) && !stepPressedKeys.has(key)
        )

        if (newPressKeys.length === step.pressKeys.length) {
          // Add press keys to matched keys and track them
          newPressKeys.forEach((key) => {
            matchedKeys.add(key)
            stepPressedKeys.add(key)
          })
          isMatch = true
          isComplete = true

          if (this.debugEnabled) {
            console.log(`[SequenceManager] Hold step completed:`, {
              step: state.currentStep + 1,
              newPressKeys,
              allPressedKeys: Array.from(stepPressedKeys),
              heldKeys: Array.from(frame.heldKeys)
            })
          }
        }
      } else {
        isMatch = true
      }
    }

    const timingScore = isMatch ? this.calculateTimingScore(frame, step.minHoldFrames) : 0

    return {
      isMatch,
      isComplete,
      matchedKeys,
      timingScore
    }
  }

  /**
   * Calculate timing score (0-1) based on frame timing
   */
  private calculateTimingScore(frame: KeyboardFrame, targetFrames: number): number {
    // Simple linear score based on frame timing
    // Could be made more sophisticated with curve/weighting
    return Math.max(0, 1 - frame.frameNumber / targetFrames)
  }
}

// Export singleton instance
export const sequenceManagerFeature = new SequenceManager()
