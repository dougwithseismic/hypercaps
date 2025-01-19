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
export interface FrameInput {
  justPressed: Record<KeyInput, number | undefined> // key => press time if pressed this frame
  justReleased: KeyInput[]
  currentlyHeld: KeyInput[]
  holdDuration: Record<KeyInput, number | undefined>
  // optional: moveHit?: boolean; // for hitConfirm steps, if you want that
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

  /** The key(s) or direction(s). e.g. ['down'], or ['ctrl','space']. */
  keys?: KeyInput[]

  /** For hold steps: must hold key(s) at least this many ms. */
  minHoldMs?: number

  /** If you hold beyond this, fail the move. (For charge moves, e.g. 3s max) */
  maxHoldMs?: number

  /** Must start this step within X ms from the previous step's completion. */
  maxGapMs?: number

  /** For multi-press steps: how close in time the keys need to be pressed. */
  multiPressToleranceMs?: number

  /** For hold steps: only completes once user releases after minHold is reached. */
  completeOnReleaseAfterMinHold?: boolean

  /** (Optional) for advanced usage: diagonal tolerance, or advanced logic. */
  diagonalToleranceMs?: number
}

/**
 * A single move definition: "Hadouken", "QCF", "Sonic Boom" etc.
 * onComplete / onFail are optional callbacks.
 */
export interface MoveDefinition {
  name: string
  steps: MoveStep[]
  onComplete?: () => void
  onFail?: () => void
}

/**
 * Tracks each move's progress, including which step is active, start time, etc.
 */
export interface ActiveMoveState {
  move: MoveDefinition
  currentStepIndex: number
  stepStartTime: number
  firedHoldMinEvent?: boolean
  isDone: boolean // if the move is completed or failed
}

/**
 * Events emitted by the sequence manager
 */
export interface SequenceManagerEvents {
  'move:complete': { name: string }
  'move:fail': { name: string; reason: string; step: number }
}
