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

export class SequenceManager {
  private activeStates = new Map<string, SequenceState>()
  private pendingMatches = new Map<string, PendingMatch>()
  private frameBuffer: KeyboardFrame[] = []
  private isInitialized = false

  constructor() {
    this.handleFrame = this.handleFrame.bind(this)
  }

  /**
   * Initialize the sequence manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // Subscribe to keyboard store changes
    keyboardStore.subscribe((config) => {
      if (config.service.enabled) {
        sequenceManager.setFrameRate(config.service.frameRate)
        sequenceManager.setBufferSize(config.service.frameBufferSize)
      }
    })

    // Subscribe to sequence store changes
    sequenceStore.subscribe((config) => {
      if (!config.isEnabled) {
        this.reset()
      }
    })

    // Initialize frame buffer
    const config = sequenceStore.get()
    this.frameBuffer = new Array(config.bufferSize).fill({
      timestamp: 0,
      frameNumber: 0,
      heldKeys: new Set(),
      justPressed: new Set(),
      justReleased: new Set()
    })

    this.isInitialized = true
  }

  /**
   * Handle a new keyboard frame
   */
  private handleFrame(frame: KeyboardFrame): void {
    const config = sequenceStore.get()
    if (!config.isEnabled) {
      return
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

      if (result.isComplete) {
        // Move to next step or complete sequence
        if (state.currentStep === sequence.steps.length - 1) {
          this.handleSequenceComplete(id, state, frame)
        } else {
          state.currentStep++
          this.emitProgress(id, state)
        }
      } else if (!result.isMatch && sequence.strictOrder) {
        this.handleSequenceFailed(id, state, 'wrong_order')
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
      if (this.activeStates.has(id) || this.pendingMatches.has(id)) {
        continue
      }

      const firstStep = sequence.steps[0]
      const result = this.evaluateStep(firstStep, frame, {
        id,
        currentStep: 0,
        startFrame: frame.frameNumber,
        elapsedFrames: 0,
        matchedKeys: new Set(),
        confidence: 0
      })

      if (result.isMatch) {
        // Start tracking this sequence
        this.activeStates.set(id, {
          id,
          currentStep: result.isComplete ? 1 : 0,
          startFrame: frame.frameNumber,
          elapsedFrames: 0,
          matchedKeys: result.matchedKeys,
          confidence: result.timingScore * 100
        })
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
    sequenceStore.update({
      update: () => {
        // No state update needed
      }
    })

    // Emit event through store subscription
    const unsubscribe = sequenceStore.on({
      event: 'sequence:detected',
      handler: () => ({
        id,
        sequence,
        durationFrames: state.elapsedFrames,
        startFrame: state.startFrame,
        endFrame: frame.frameNumber,
        timestamp: frame.timestamp
      })
    })
    unsubscribe() // Immediately unsubscribe since this is a one-time event

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
    sequenceStore.update({
      update: () => {
        // No state update needed
      }
    })

    // Emit event through store subscription
    const unsubscribe = sequenceStore.on({
      event: 'sequence:failed',
      handler: () => ({
        id,
        reason,
        failedAtStep: state.currentStep
      })
    })
    unsubscribe() // Immediately unsubscribe since this is a one-time event

    this.activeStates.delete(id)
  }

  /**
   * Emit sequence progress
   */
  private emitProgress(id: string, state: SequenceState): void {
    const sequence = sequenceStore.get().sequences[id]
    sequenceStore.update({
      update: () => {
        // No state update needed
      }
    })

    // Emit event through store subscription
    const unsubscribe = sequenceStore.on({
      event: 'sequence:progress',
      handler: () => ({
        id,
        currentStep: state.currentStep,
        totalSteps: sequence.steps.length,
        elapsedFrames: state.elapsedFrames
      })
    })
    unsubscribe() // Immediately unsubscribe since this is a one-time event
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

    // Check if all required keys are pressed within tolerance
    for (const key of step.keys) {
      if (frame.justPressed.has(key) || frame.heldKeys.has(key)) {
        matchedKeys.add(key)
      }
    }

    const isMatch = matchedKeys.size === step.keys.length
    const timingScore = isMatch ? this.calculateTimingScore(frame, tolerance) : 0

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
    const matchedKeys = new Set<number>()
    let isMatch = false
    let isComplete = false

    // Get the next required key in sequence
    const nextKey = step.keys[state.matchedKeys.size]

    if (nextKey) {
      // Check if the next key is pressed
      if (frame.justPressed.has(nextKey)) {
        matchedKeys.add(nextKey)
        isMatch = true

        // Check if sequence is complete
        isComplete = matchedKeys.size === step.keys.length
      } else if (!step.allowExtraInputs && frame.justPressed.size > 0) {
        // Extra keys pressed when not allowed
        isMatch = false
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

    // Check if all hold keys are held
    const allHoldKeysHeld = step.holdKeys.every((key) => frame.heldKeys.has(key))
    if (allHoldKeysHeld) {
      // Add hold keys to matched keys
      step.holdKeys.forEach((key) => matchedKeys.add(key))

      // Check if we've held long enough
      if (state.elapsedFrames >= step.minHoldFrames) {
        // Check if press keys are pressed
        const pressKeysPressed = step.pressKeys.every((key) => frame.justPressed.has(key))
        if (pressKeysPressed) {
          // Add press keys to matched keys
          step.pressKeys.forEach((key) => matchedKeys.add(key))
          isMatch = true
          isComplete = true
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
