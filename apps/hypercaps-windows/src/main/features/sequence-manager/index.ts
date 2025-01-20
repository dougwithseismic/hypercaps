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
import { InputBuffer } from './input-buffer'
import { sequenceStore } from './store'
import type { ActiveMoveState, MoveDefinition, MoveStep } from './types'

/**
 * The SequenceManager maintains a rolling buffer of keyboard inputs and provides
 * a framework for detecting input sequences. This is a stripped down version
 * that will be rebuilt with proper detection logic.
 */
export class SequenceManager extends EventEmitter {
  private static instance: SequenceManager
  private inputBuffer: InputBuffer
  private moves: MoveDefinition[] = []
  private activeMoves: ActiveMoveState[] = []
  private isInitialized = false
  private config = sequenceStore.get()
  private readonly FRAME_RATE = 60 // TODO: Get this from keyboard config
  private readonly LENIENCY_MS = 200 // ~12 frames worth of leniency
  private readonly SIMULTANEOUS_PRESS_MS = 32 // ~2 frames at 60fps for simultaneous press
  private readonly COMPLETION_WINDOW_MS = 64 // Window to check for competing completed moves

  // Track moves that completed but are waiting for the completion window
  private completionWindow: Array<{
    move: MoveDefinition
    completedAt: number
  }> = []

  private constructor(private bufferWindowMs = 5000) {
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
   * Convert frame count to milliseconds based on frame rate
   */
  private framesToMs(frames: number): number {
    return Math.floor((frames * 1000) / this.FRAME_RATE)
  }

  /**
   * Check if keys were pressed within a small time window of each other
   */
  private wereKeysSimultaneous(frame: KeyboardFrameEvent, keys: string[]): boolean {
    if (keys.length <= 1) return true

    const events = this.inputBuffer.getEvents()
    const cutoffTime = frame.timestamp - this.SIMULTANEOUS_PRESS_MS
    const recentPresses = new Map<string, number>() // key -> timestamp

    // Look back through recent frames
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      if (event.timestamp < cutoffTime) break

      event.state.justPressed.forEach((key) => {
        if (!recentPresses.has(key)) {
          recentPresses.set(key, event.timestamp)
        }
      })
    }

    // Check if all required keys were pressed and get their timestamps
    const timestamps: number[] = []
    for (const key of keys) {
      const timestamp = recentPresses.get(key)
      if (timestamp === undefined) return false
      timestamps.push(timestamp)
    }

    // Check if max time difference between any two presses is within window
    const maxTimeDiff = Math.max(...timestamps) - Math.min(...timestamps)
    return maxTimeDiff <= this.SIMULTANEOUS_PRESS_MS
  }

  /**
   * Check if a key has been held for the required duration
   */
  private checkHoldDuration(frame: KeyboardFrameEvent, key: string, minHoldMs: number): boolean {
    const holdDuration = this.framesToMs(frame.state.holdDurations[key] ?? 0)
    return holdDuration >= minHoldMs
  }

  /**
   * Check if a sequence of keys was pressed in order within the leniency window
   */
  private checkSequence(frame: KeyboardFrameEvent, keys: string[], maxGapMs: number): boolean {
    const events = this.inputBuffer.getEvents()
    const cutoffTime = frame.timestamp - maxGapMs
    let currentKeyIndex = keys.length - 1
    let lastMatchTime = frame.timestamp
    const foundKeys = new Set<string>()
    const extraInputTimes = new Set<number>()

    // Work backwards through the buffer
    for (let i = events.length - 1; i >= 0 && currentKeyIndex >= 0; i--) {
      const event = events[i]
      if (event.timestamp < cutoffTime) break

      // Track all inputs we see for leniency
      event.state.justPressed.forEach((key) => {
        if (!keys.includes(key)) {
          extraInputTimes.add(event.timestamp)
        }
        foundKeys.add(key)
      })

      // If this frame has our current target key
      if (event.state.justPressed.includes(keys[currentKeyIndex])) {
        // Check if the gap between this and the last match is within maxGap
        if (lastMatchTime - event.timestamp > maxGapMs) return false
        lastMatchTime = event.timestamp
        currentKeyIndex--
      }
    }

    // Basic sequence match
    if (currentKeyIndex >= 0) return false

    // Leniency check - allow extra inputs within the leniency window
    const requiredKeys = new Set(keys)
    const hasAllRequired = [...requiredKeys].every((k) => foundKeys.has(k))

    // Group extra inputs by time windows
    let leniencyViolations = 0
    const sortedTimes = [...extraInputTimes].sort((a, b) => a - b)

    // Count how many separate leniency windows were violated
    let lastTime = 0
    for (const time of sortedTimes) {
      if (time - lastTime > this.LENIENCY_MS) {
        leniencyViolations++
      }
      lastTime = time
    }

    return hasAllRequired && leniencyViolations === 0
  }

  /**
   * Check if a step's conditions are met
   */
  private checkStep(
    step: MoveStep,
    frame: KeyboardFrameEvent,
    now: number,
    stepStartTime: number
  ): boolean {
    const { type, keys = [], maxGapMs = 200 } = step

    switch (type) {
      case 'press': {
        // For single key or simultaneous presses
        if (step.multiPressToleranceMs) {
          return this.wereKeysSimultaneous(frame, keys)
        }
        // For sequences (like down, down-forward, forward)
        return this.checkSequence(frame, keys, maxGapMs)
      }

      case 'hold': {
        const { minHoldMs = 0, maxHoldMs, completeOnReleaseAfterMinHold } = step

        // Check each key meets the hold duration
        for (const key of keys) {
          const holdDuration = this.framesToMs(frame.state.holdDurations[key] ?? 0)

          // Fail if we've held too long
          if (maxHoldMs && holdDuration > maxHoldMs) return false

          // For release-after-hold moves
          if (completeOnReleaseAfterMinHold) {
            const isHeld = frame.state.held.includes(key)
            const meetsMinHold = holdDuration >= minHoldMs

            // If still held, only complete if we want to wait for release
            if (isHeld) return !completeOnReleaseAfterMinHold && meetsMinHold

            // If released, complete only if we met the min hold time
            return meetsMinHold
          }

          // Normal hold - just check duration
          if (holdDuration < minHoldMs) return false
        }
        return true
      }

      case 'hitConfirm': {
        // Not implemented for shortcut manager
        return false
      }
    }
  }

  /**
   * Start listening to keyboard frames from your electron "keyboardService."
   * Each time we get a new frame, we add it to the buffer and call `update`.
   */
  public initialize(): void {
    if (this.isInitialized) return
    this.isInitialized = true

    keyboardService.on('keyboard:frame', (frameEvent: KeyboardFrameEvent) => {
      if (!this.config.isEnabled) return
      this.inputBuffer.addFrame(frameEvent)
      this.update(frameEvent)
    })

    console.log('[SequenceManager] Initialized. Buffer window =', this.bufferWindowMs, 'ms')
  }

  /**
   * Add a move definition to be detected.
   */
  public addMove(move: MoveDefinition): void {
    this.moves.push(move)
    // Sort moves by priority (highest first) and strength (highest first)
    this.moves.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      return b.strength - a.strength
    })
    console.debug(
      `[SequenceManager] Added move "${move.name}" (priority: ${move.priority}, strength: ${move.strength})`
    )
  }

  /**
   * Called each time we want to process the buffer
   */
  public update(currentFrame: KeyboardFrameEvent): void {
    if (!this.isInitialized || !this.config.isEnabled) return

    const now = currentFrame.timestamp

    // First, check if we can resolve any moves in the completion window
    if (this.completionWindow.length > 0) {
      const oldestCompletion = Math.min(...this.completionWindow.map((c) => c.completedAt))
      if (now - oldestCompletion >= this.COMPLETION_WINDOW_MS) {
        // Time to resolve the completion window
        if (this.completionWindow.length === 1) {
          // Single move - just complete it
          const { move } = this.completionWindow[0]
          console.debug(`[SequenceManager] Completed sequence "${move.name}"`)
          move.onComplete?.()
          this.emit('move:complete', { name: move.name })
        } else {
          // Multiple moves - find highest priority/strength
          const sorted = [...this.completionWindow].sort((a, b) => {
            if (a.move.priority !== b.move.priority) {
              return b.move.priority - a.move.priority
            }
            return b.move.strength - a.move.strength
          })

          // Complete the winner, fail the others
          const winner = sorted[0]
          console.debug(
            `[SequenceManager] Completed highest priority sequence "${winner.move.name}"`
          )
          winner.move.onComplete?.()
          this.emit('move:complete', { name: winner.move.name })

          // Fail other moves that were in contention
          sorted.slice(1).forEach(({ move }) => {
            console.debug(
              `[SequenceManager] Failed sequence "${move.name}" - lost priority contest`
            )
            move.onFail?.()
            this.emit('move:fail', {
              name: move.name,
              reason: 'lost_priority_contest',
              step: move.steps.length - 1
            })
          })
        }

        // Clear the window
        this.completionWindow = []
      }
    }

    // Process active moves - check if they've progressed or failed
    for (let i = this.activeMoves.length - 1; i >= 0; i--) {
      const active = this.activeMoves[i]
      const { move, currentStepIndex, stepStartTime } = active

      // Skip completed moves
      if (active.isDone) {
        this.activeMoves.splice(i, 1)
        continue
      }

      const step = move.steps[currentStepIndex]
      const stepOk = this.checkStep(step, currentFrame, now, stepStartTime)

      if (stepOk) {
        // Move to next step
        active.currentStepIndex++
        active.stepStartTime = now

        // Check if move is complete
        if (active.currentStepIndex >= move.steps.length) {
          active.isDone = true
          // Instead of completing immediately, add to completion window
          this.completionWindow.push({
            move: active.move,
            completedAt: now
          })
          this.activeMoves.splice(i, 1)
        }
      } else {
        // Check for timeout
        const elapsed = now - stepStartTime
        if (step.maxGapMs && elapsed > step.maxGapMs) {
          console.debug(`[SequenceManager] Failed sequence "${move.name}" - timeout`)
          move.onFail?.()
          this.emit('move:fail', { name: move.name, reason: 'timeout', step: currentStepIndex })
          this.activeMoves.splice(i, 1)
        }
      }
    }

    // Try to start new moves (already sorted by priority)
    for (const move of this.moves) {
      // Skip if already active
      if (this.activeMoves.some((am) => am.move.name === move.name)) continue

      // Check first step
      const firstStep = move.steps[0]
      if (this.checkStep(firstStep, currentFrame, now, now)) {
        console.debug(`[SequenceManager] Starting sequence "${move.name}"`)
        this.activeMoves.push({
          move,
          currentStepIndex: 0,
          stepStartTime: now,
          isDone: false
        })
        // Allow multiple moves to start - they'll be resolved by priority only if they complete together
        continue
      }
    }

    // Keep the buffer pruned
    this.inputBuffer.tick(now)
  }
}

// Export singleton instance
export const sequenceManager = SequenceManager.getInstance()
