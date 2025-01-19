// types.ts
// --------------------------------------------------
// Collection of shared types/interfaces used across
// our fighting-game input system, including:
//   - KeyInput enumeration
//   - Step types for move definitions, etc.
// --------------------------------------------------

import type { KeyboardFrameState } from '../../service/keyboard/types'

/**
 * List of all possible key inputs recognized by the system.
 * Extend this as needed (e.g., 'downLeft', 'threePunch', etc.).
 */
export type KeyInput = string // Any valid VK key code

/**
 * FrameInput extends the keyboard service's frame state with
 * game-specific metadata like moveHit.
 */
export interface FrameInput extends KeyboardFrameState {
  // Game-specific flags or metadata
  moveHit?: boolean // e.g. did the last move connect this frame?
}

/**
 * StepType represents the different logic a step might follow.
 *   - press: user must press certain keys in a timeframe
 *   - hold: user must hold certain keys for a certain duration
 *   - hitConfirm: user must confirm a successful hit in a window
 */
export type StepType = 'press' | 'hold' | 'hitConfirm'

/**
 * MoveStep describes a single stage in a move's input sequence.
 * Each step can have:
 *   - required keys
 *   - min/max hold times
 *   - time-gap constraints
 *   - multi-key press tolerances
 *   - or a hitConfirm window
 */
export interface MoveStep {
  type: StepType

  // For press/hold
  keys?: KeyInput[]
  minHoldMs?: number // must hold at least this long
  maxHoldMs?: number // fail if held longer than this
  maxGapMs?: number // must begin step within X ms of previous step
  multiPressToleranceMs?: number // leniency for pressing multiple keys
  onHoldMinReached?: () => void // callback once minHold is reached
  completeOnReleaseAfterMinHold?: boolean // step only completes on release after minHoldMs

  // For 'hitConfirm'
  hitConfirmWindowMs?: number // must confirm hit within this window
}

/**
 * MoveDefinition is a full move: a name, an ordered list of steps,
 * and optional callbacks for when the move completes or fails.
 */
export interface MoveDefinition {
  name: string
  steps: MoveStep[]
  onComplete?: () => void
  onFail?: () => void
}

/**
 * MoveState tracks the current progress within a move:
 *   - which move is active,
 *   - currentStepIndex,
 *   - when we started (or completed) the previous step,
 *   - whether we've already fired hold-based events (e.g., onHoldMinReached).
 */
export interface MoveState {
  move: MoveDefinition
  currentStepIndex: number
  stepStartTime: number
  isActive: boolean
  firedHoldMinEvent?: boolean // track if we've already triggered onHoldMinReached
}

/**
 * BufferPatternStep defines a single key press requirement in a pattern,
 * with a maximum time gap allowed from the previous step.
 */
export interface BufferPatternStep {
  key: string
  maxGapMs: number
  // Hold duration constraints
  minHoldMs?: number
  maxHoldMs?: number
  // Multi-key press support
  keys?: string[]
  multiPressToleranceMs?: number
}

export interface InputSequence {
  id: string
  pattern: BufferPatternStep[]
}
