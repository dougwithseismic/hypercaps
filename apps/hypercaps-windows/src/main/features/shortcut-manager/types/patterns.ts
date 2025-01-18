import type { ShortcutAction, TriggerStep } from '../types'

/**
 * Valid pattern node types
 */
export type PatternNodeType = 'hold' | 'combo'

/**
 * Pattern node conditions
 */
export interface PatternNodeConditions {
  window: number
  holdTime?: number
  strict: boolean
}

/**
 * Represents a node in the pattern tree
 */
export interface PatternNode {
  keys: string[]
  type: PatternNodeType
  patterns: ShortcutPattern[]
  children: Map<string, PatternNode>
  conditions: PatternNodeConditions
}

/**
 * Represents a shortcut pattern in the tree
 */
export interface ShortcutPattern {
  id: string
  remainingSteps: TriggerStep[]
  action: ShortcutAction
  confidence: number
  priority: number
}

/**
 * Represents the state of an active pattern match
 */
export interface PatternState {
  patternId: string
  currentNode: PatternNode
  startTime: number
  confidence: number
  matchedKeys: Set<string>
}

/**
 * Result of a successful pattern match
 */
export interface PatternMatchResult {
  pattern: ShortcutPattern
  state: PatternState
  endTime: number
}

/**
 * Result of evaluating a single step
 */
export interface StepMatchResult {
  isMatch: boolean
  isStrict: boolean
  isComplete: boolean
  matchedKeys: Set<string>
  pattern?: ShortcutPattern
  timingScore: number
}

/**
 * Represents a pending match during grace period
 */
export interface PendingMatch {
  result: PatternMatchResult
  expiresAt: number
  priority: number
}
