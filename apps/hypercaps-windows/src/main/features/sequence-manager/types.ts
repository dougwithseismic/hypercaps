/**
 * Step types for input sequences
 */

/**
 * Multiple keys pressed simultaneously
 */
export interface ChordStep {
  type: 'CHORD'
  keys: number[]
  toleranceMs: number
}

/**
 * Keys pressed in specific order
 */
export interface SequenceStep {
  type: 'SEQUENCE'
  keys: number[]
  maxGapMs: number
  allowExtraInputs: boolean
}

/**
 * Hold key(s) for duration while pressing others
 */
export interface HoldStep {
  type: 'HOLD'
  holdKeys: number[]
  pressKeys: number[]
  minHoldMs: number
  maxHoldMs?: number
}

/**
 * Input sequence definition
 */
export interface InputSequence {
  id: string
  steps: (ChordStep | SequenceStep | HoldStep)[]
  timeoutMs: number
  strictOrder: boolean
}

/**
 * Sequence state tracking
 */
export interface SequenceState {
  id: string
  currentStep: number
  startTime: number
  elapsedMs: number
  matchedKeys: Set<number>
  confidence: number
  pressedKeysPerStep: Map<number, Set<number>>
}

/**
 * Frame data from keyboard service
 */
export interface KeyboardFrame {
  timestamp: number
  frameNumber: number
  heldKeys: Set<number>
  justPressed: Set<number>
  justReleased: Set<number>
}

/**
 * Step match result
 */
export interface StepMatchResult {
  isMatch: boolean
  isComplete: boolean
  matchedKeys: Set<number>
  timingScore: number
}

/**
 * Pending sequence match
 */
export interface PendingMatch {
  sequenceId: string
  state: SequenceState
  expiresAt: number
  priority: number
}
