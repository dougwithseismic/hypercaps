/**
 * Step types for input sequences
 */

export interface SequenceHistory {
  id: string
  timestamp: number
  frameNumber: number
  duration: number
}

/**
 * Base step type
 */
export interface BaseStep {
  type: string
  timeoutMs?: number
  id?: string
}

/**
 * Verifies specific keys are held in a frame.
 * The step will trigger exactly at triggerMs if specified, otherwise
 * it completes when keys are released after minMs (and before maxMs).
 *
 * If no duration is specified, the step will trigger when the keys are
 * released after minMs (and before maxMs).
 */
export interface StateStep extends BaseStep {
  type: 'STATE'
  pressed?: number[] // Keys that must be pressed in this frame
  held?: number[] // Keys that must be held in this frame
  released?: number[] // Keys that must be released in this frame
  toleranceMs: number // Allowed timing variance
  duration?: {
    minMs?: number // Minimum time state must be true
    maxMs?: number // Maximum time state can be true
    triggerMs?: number // If set, step triggers exactly at this duration
  }
}

/**
 * Container for nested steps
 */
export interface SequenceStep extends BaseStep {
  type: 'SEQUENCE'
  steps: (StateStep | SequenceStep)[]
}

export type Step = StateStep | SequenceStep

/**
 * Input sequence definition - can be either a single state check or a sequence of steps
 */
export type InputSequence = {
  id: string
  cooldownMs?: number
} & (
  | ({ type: 'STATE' } & Omit<StateStep, 'type'>)
  | ({ type: 'SEQUENCE' } & Omit<SequenceStep, 'type'>)
)

/**
 * Sequence state tracking
 */
export interface SequenceState {
  id: string
  currentStep: number
  isComplete: boolean
  isFailed: boolean
  startTime: number
  elapsedMs: number
  confidence: number
  parentStates?: SequenceState[]
  childState?: SequenceState
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
  matchedKeys: {
    pressed: Set<number>
    held: Set<number>
    released: Set<number>
  }
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

/**
 * Rolling input buffer
 */
export interface InputBuffer {
  frames: KeyboardFrame[]
  maxSize: number
  currentIndex: number
}

/**
 * Sequence match result
 */
export interface SequenceMatch {
  sequenceId: string
  confidence: number
  startFrame: number
  endFrame: number
  consumedInputs: Set<number>
  matchedKeys: {
    pressed: Set<number>
    held: Set<number>
    released: Set<number>
  }
}

/**
 * Sequence match events
 */
export interface SequenceMatchEvents {
  'sequence:complete': {
    id: string
    duration: number
    startTime: number
    endTime: number
    confidence: number
    matchedKeys: {
      pressed: Set<number>
      held: Set<number>
      released: Set<number>
    }
  }
  'sequence:failed': {
    id: string
    reason: 'timeout' | 'invalid_input' | 'state_lost' | 'duration_exceeded'
    startTime: number
  }
}
