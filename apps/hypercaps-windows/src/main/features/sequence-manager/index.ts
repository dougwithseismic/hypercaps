import { EventEmitter } from 'events'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import type { InputSequence } from './types'

/**
 * Manages keyboard input sequences and detects patterns in real-time.
 *
 * The SequenceManager listens to keyboard frames and matches them against defined
 * input sequences (patterns). When a sequence is detected, it emits a 'sequence:detected'
 * event and calls any registered callbacks.
 *
 * Example:
 * ```ts
 * const manager = new SequenceManager()
 * manager.initialize()
 *
 * // Add a sequence to detect Shift+A followed by B within 500ms
 * manager.addSequence({
 *   id: 'shift-a-b',
 *   pattern: [
 *     { keys: ['Shift', 'A'], maxGapMs: 500 },
 *     { key: 'B', maxGapMs: 500 }
 *   ]
 * })
 *
 * manager.on('sequence:detected', (event) => {
 *   console.log(`Detected sequence: ${event.id}`)
 * })
 * ```
 */
export class SequenceManager extends EventEmitter {
  isInitialized = false
  private sequences: InputSequence[] = []
  private activeSequences: Map<
    string,
    { startFrame: number; currentStep: number; lastStepTime: number }
  > = new Map()
  private moveCallbacks: Map<string, { onComplete?: () => void; onFail?: () => void }> = new Map()

  constructor() {
    super()
    this.on('sequence:detected', (event) => {
      const callbacks = this.moveCallbacks.get(event.id)
      if (callbacks?.onComplete) {
        callbacks.onComplete()
      }
    })
  }

  /**
   * Initializes the sequence manager and starts listening for keyboard frames.
   * Must be called before the manager can detect sequences.
   */
  initialize(): void {
    console.log('Initializing sequence manager')
    keyboardService.on('keyboard:frame', (event) => this.handleFrame(event))
    this.isInitialized = true
  }

  /**
   * Adds a new sequence to be detected and optionally registers callbacks.
   *
   * @param sequence - The input sequence pattern to detect
   * @param callbacks - Optional callbacks for sequence completion or failure
   *                   onComplete is called when the sequence is successfully detected
   *                   onFail is called when a sequence fails (e.g., timeout)
   */
  addSequence(
    sequence: InputSequence,
    callbacks?: { onComplete?: () => void; onFail?: () => void }
  ): void {
    this.sequences.push(sequence)
    if (callbacks) {
      this.moveCallbacks.set(sequence.id, callbacks)
    }
  }

  /**
   * Processes a keyboard frame and checks it against all active and potential sequences.
   * This is called for every frame when the gate is open.
   *
   * For each sequence, it:
   * 1. Tries to start new sequences if the frame matches their first step
   * 2. Advances existing sequences if the frame matches their next step
   * 3. Fails sequences if they exceed their time window
   * 4. Completes sequences when all steps are matched
   *
   * @param event - The keyboard frame event containing the current input state
   */
  handleFrame(event: KeyboardFrameEvent): void {
    if (!this.isInitialized) {
      console.warn('Sequence manager not initialized')
      return
    }

    // Check each sequence
    for (const sequence of this.sequences) {
      const activeState = this.activeSequences.get(sequence.id)

      if (!activeState) {
        // Try to start sequence
        if (this.matchesFirstStep(sequence, event)) {
          this.activeSequences.set(sequence.id, {
            startFrame: event.frameNumber,
            currentStep: 1,
            lastStepTime: event.timestamp
          })
        }
        continue
      }

      // Check next step
      const currentStep = sequence.pattern[activeState.currentStep]
      if (!currentStep) {
        // Sequence complete
        console.log('Sequence complete:', sequence.id)
        this.emit('sequence:detected', {
          id: sequence.id,
          sequence,
          durationFrames: event.frameNumber - activeState.startFrame + 1,
          startFrame: activeState.startFrame,
          endFrame: event.frameNumber,
          timestamp: event.timestamp
        })
        this.activeSequences.delete(sequence.id)
        continue
      }

      // Check if we've exceeded the time window
      const timeSinceLastStep = event.timestamp - activeState.lastStepTime
      if (timeSinceLastStep > currentStep.maxGapMs) {
        console.log('Sequence failed - time window exceeded:', {
          sequence: sequence.id,
          timeSinceLastStep,
          maxGapMs: currentStep.maxGapMs
        })
        this.activeSequences.delete(sequence.id)
        const callbacks = this.moveCallbacks.get(sequence.id)
        if (callbacks?.onFail) {
          callbacks.onFail()
        }
        continue
      }

      if (this.matchesStep(currentStep, event)) {
        console.log('Step matched:', {
          sequence: sequence.id,
          step: activeState.currentStep,
          key: currentStep.key
        })
        // Advance to next step
        const nextStepIndex = activeState.currentStep + 1
        if (nextStepIndex >= sequence.pattern.length) {
          // All steps complete
          console.log('All steps complete:', sequence.id)
          this.emit('sequence:detected', {
            id: sequence.id,
            sequence,
            durationFrames: event.frameNumber - activeState.startFrame + 1,
            startFrame: activeState.startFrame,
            endFrame: event.frameNumber,
            timestamp: event.timestamp
          })
          this.activeSequences.delete(sequence.id)
        } else {
          this.activeSequences.set(sequence.id, {
            ...activeState,
            currentStep: nextStepIndex,
            lastStepTime: event.timestamp
          })
        }
      }
    }
  }

  /**
   * Checks if a keyboard frame matches the first step of a sequence.
   * This is used to determine if we should start tracking a new sequence.
   *
   * @param sequence - The sequence to check
   * @param event - The keyboard frame event
   * @returns true if the frame matches the first step of the sequence
   */
  private matchesFirstStep(sequence: InputSequence, event: KeyboardFrameEvent): boolean {
    const firstStep = sequence.pattern[0]

    // Check if this is a hold step (has minHoldMs)
    if (firstStep.minHoldMs) {
      // For hold steps, check if the key is currently held and has been held long enough
      const holdDuration = event.state.holdDurations[firstStep.key]
      return holdDuration !== undefined && holdDuration >= firstStep.minHoldMs
    }

    // For multi-key press steps, check if all keys were pressed within tolerance
    if (firstStep.keys && firstStep.keys.length > 1) {
      const allKeysPressed = firstStep.keys.every((key) => event.state.justPressed.includes(key))
      return allKeysPressed
    }

    // Single key press step
    return event.state.justPressed.includes(firstStep.key)
  }

  /**
   * Checks if a keyboard frame matches a specific step in a sequence.
   * This is used to check if we should advance to the next step.
   *
   * @param step - The step to check against
   * @param event - The keyboard frame event
   * @returns true if the frame matches the step's requirements
   */
  private matchesStep(step: InputSequence['pattern'][0], event: KeyboardFrameEvent): boolean {
    // Check if this is a hold step
    if (step.minHoldMs) {
      // For hold steps, check if the key is currently held and has been held long enough
      const holdDuration = event.state.holdDurations[step.key]
      return holdDuration !== undefined && holdDuration >= step.minHoldMs
    }

    // For multi-key press steps, check if all keys were pressed within tolerance
    if (step.keys && step.keys.length > 1) {
      const allKeysPressed = step.keys.every((key) => event.state.justPressed.includes(key))
      return allKeysPressed
    }

    // Single key press step
    return event.state.justPressed.includes(step.key)
  }
}

export const sequenceManagerFeature = new SequenceManager()
