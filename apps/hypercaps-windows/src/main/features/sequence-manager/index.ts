/**
 * Advanced Sequence Manager for Electron-based Shortcut Detection
 * ===============================================================
 *
 * This is a robust, "fighting-game style" sequence manager that:
 * 1) Maintains a rolling InputBuffer of keyboard frames.
 * 2) On each new KeyboardFrameEvent, it builds a "FrameInput" snapshot and
 *    checks for multiple possible moves (like QCF, QCB, hold-based, multi-press,
 *    diagonal, etc.).
 * 3) Supports multiple active moves at once (e.g. user can start "Hadouken" and
 *    "Lightning Legs" if your design allows).
 * 4) Allows advanced steps:
 *    - `press` (quarter-circle steps, single or multi-key),
 *    - `hold` (charge moves or custom hold durations),
 *    - `hitConfirm` (optional, if needed),
 *    - plus partial diagonals (like `down + right => downRight`).
 *
 * This system is suitable for an Electron environment where each keyboard frame
 * is an event from a low-level OS hook or "keyboardService." No continuous game loop
 * is required—each time we get a "keyboard:frame" event, we update the manager.
 *
 * If you want to handle partial diagonals or "down + right = downRight," you can do so
 * either in the buffer-building logic or treat them as separate steps. The example code
 * below demonstrates a robust approach with:
 *    - A rolling InputBuffer
 *    - A buildFrameInputFromBuffer function that merges the last ~16ms of data
 *    - A manager that tracks multiple active moves
 *    - Street Fighter–like QCF (quarter-circle forward) or QCB (quarter-circle back) moves
 *    - A hold-based "charge" move
 *    - Multi-press tolerance, etc.
 *
 * Enjoy the advanced solution—no baby stuff here. ;)
 */

import { EventEmitter } from 'events'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import { InputBuffer, buildFrameInputFromBuffer } from './input-buffer'
import type {
  ActiveMoveState,
  FrameInput,
  MoveDefinition,
  MoveStep,
  SequenceManagerEvents
} from './types'
import { sequenceStore } from './store'

/**
 * The big SequenceManager that:
 *  - Listens for "keyboard:frame" events
 *  - Stores them in a rolling buffer
 *  - On each frame arrival, merges input into a FrameInput
 *  - Checks *all* moves (Street Fighter style). Each move can be partially active
 *    if you want to allow concurrency, or you can handle one active move at a time.
 *  - For each step, checks press vs hold logic, diagonal logic, multi-press tolerance, etc.
 */
export class SequenceManager extends EventEmitter {
  private static instance: SequenceManager
  private inputBuffer: InputBuffer
  private moves: MoveDefinition[] = []
  private activeMoves: ActiveMoveState[] = [] // track multiple simultaneously
  private isInitialized = false
  private config = sequenceStore.get()

  private constructor(private bufferWindowMs = 2000) {
    super()
    this.inputBuffer = new InputBuffer(bufferWindowMs)
    this.setupStoreListeners()
  }

  public static getInstance(): SequenceManager {
    if (!SequenceManager.instance) {
      SequenceManager.instance = new SequenceManager()
    }
    return SequenceManager.instance
  }

  private setupStoreListeners(): void {
    sequenceStore.on({
      event: 'store:changed',
      handler: ({ config }) => {
        this.config = config
        if (!config.isEnabled) {
          this.inputBuffer.clear()
          this.activeMoves = []
        }
      }
    })
  }

  /**
   * Start listening to keyboard frames from your electron "keyboardService."
   * Each time we get a new frame, we add it to the buffer and call `update`.
   */
  public initialize() {
    if (this.isInitialized) return
    this.isInitialized = true

    keyboardService.on('keyboard:frame', (frameEvent: KeyboardFrameEvent) => {
      if (!this.config.isEnabled) return
      // 1) add to buffer
      this.inputBuffer.addFrame(frameEvent)
      // 2) call update with the event's timestamp
      this.update(frameEvent.timestamp)
    })

    console.log('[SequenceManager] Initialized. Buffer window =', this.bufferWindowMs, 'ms')
  }

  /**
   * Add a move (e.g., QCF, SonicBoom, hold ctrl+space, etc.)
   * with optional onComplete/onFail handlers.
   */
  public addMove(move: MoveDefinition) {
    this.moves.push(move)
  }

  /**
   * Called each time we want to process the buffer (like after each keyboard frame).
   * If you want, you can also call it from setInterval or any other trigger.
   */
  public update(now: number) {
    if (!this.isInitialized || !this.config.isEnabled) return

    // prune old events if needed
    this.inputBuffer.tick(now)

    // Build a single snapshot for this moment
    const frameInput = buildFrameInputFromBuffer(this.inputBuffer, now)

    // 1) Attempt to START any moves that are not active if their first step is satisfied
    for (const move of this.moves) {
      // If this move is already done or active, skip. But let's see if we want concurrency or not
      const isMoveActive = this.activeMoves.find((m) => m.move.name === move.name && !m.isDone)
      if (isMoveActive) {
        // skip if it's already in progress
        continue
      }

      // Check first step
      const firstStep = move.steps[0]
      // If we satisfy it, let's begin tracking
      if (this.checkStep(firstStep, frameInput, now, now)) {
        this.activeMoves.push({
          move,
          currentStepIndex: 0,
          stepStartTime: now,
          isDone: false
        })
      }
    }

    // 2) For each active move, try to progress it
    for (const active of this.activeMoves) {
      if (active.isDone) continue // skip if done
      const { move, currentStepIndex, stepStartTime } = active
      const step = move.steps[currentStepIndex]
      const stepOk = this.checkStep(step, frameInput, now, stepStartTime)

      if (stepOk) {
        // Step complete => next
        active.currentStepIndex++
        active.stepStartTime = now

        // If that was last step => move complete
        if (active.currentStepIndex >= move.steps.length) {
          active.isDone = true
          move.onComplete?.()
          this.emit('move:complete', { name: move.name })
        }
        continue
      }

      // Not completed => check fail conditions
      const elapsed = now - stepStartTime
      if (step.maxGapMs && elapsed > step.maxGapMs) {
        // Time out => fail
        active.isDone = true
        move.onFail?.()
        this.emit('move:fail', { name: move.name, reason: 'timeout', step: currentStepIndex })
      }
    }

    // Clean up activeMoves that are done
    this.activeMoves = this.activeMoves.filter((m) => !m.isDone)
  }

  /**
   * The logic that decides if "press" or "hold" step is satisfied by the current FrameInput.
   */
  private checkStep(
    step: MoveStep,
    frameInput: FrameInput,
    now: number,
    stepStartTime: number
  ): boolean {
    switch (step.type) {
      case 'press':
        return this.checkPressStep(step, frameInput, now, stepStartTime)
      case 'hold':
        return this.checkHoldStep(step, frameInput, now)
      case 'hitConfirm':
        // If you want a "moveHit" flag or something, check it here
        return false // placeholder
      default:
        return false
    }
  }

  private checkPressStep(
    step: MoveStep,
    input: FrameInput,
    now: number,
    stepStartTime: number
  ): boolean {
    const { keys = [], multiPressToleranceMs } = step
    if (!keys.length) return false

    // All keys must appear in justPressed
    const pressTimes = keys.map((k) => input.justPressed[k])
    if (pressTimes.some((t) => t === undefined)) {
      return false // not all were pressed this frame
    }

    // If multiPressToleranceMs is set, ensure the difference between earliest & latest press
    if (multiPressToleranceMs && multiPressToleranceMs > 0) {
      const earliest = Math.min(...(pressTimes as number[]))
      const latest = Math.max(...(pressTimes as number[]))
      if (latest - earliest > multiPressToleranceMs) {
        return false // they were pressed too far apart
      }
    }

    // If we got here => success
    return true
  }

  private checkHoldStep(step: MoveStep, input: FrameInput, now: number): boolean {
    const { keys = [], minHoldMs = 0, maxHoldMs, completeOnReleaseAfterMinHold } = step
    if (!keys.length) return false

    // All must be (or have been) held
    const durations = keys.map((k) => input.holdDuration[k] ?? 0)
    const minDuration = Math.min(...durations)

    if (maxHoldMs && minDuration > maxHoldMs) {
      return false // overcharge => fail
    }

    if (completeOnReleaseAfterMinHold) {
      // We only consider it complete once user releases after minHold
      const stillHeld = keys.every((k) => input.currentlyHeld.includes(k))
      if (stillHeld) {
        return false
      } else {
        // They released. Check if minHold was satisfied
        return minDuration >= minHoldMs
      }
    }

    // Otherwise, as soon as minDuration >= minHold, we say it's complete
    return minDuration >= minHoldMs
  }
}

// Export singleton instance
export const sequenceManager = SequenceManager.getInstance()
