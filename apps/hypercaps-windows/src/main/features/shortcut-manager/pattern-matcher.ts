import type { KeyboardFrame } from './types'
import type {
  PatternNode,
  PatternState,
  PatternMatchResult,
  StepMatchResult,
  PendingMatch,
  ShortcutPattern
} from './types/patterns'

export class PatternMatcher {
  private activeStates = new Map<string, PatternState>()
  private pendingMatches = new Map<string, PendingMatch>()
  private readonly EXECUTION_GRACE_PERIOD = 100 // ms to wait for potential longer matches
  private readonly MAX_CONFIDENCE = 100
  private readonly BASE_CONFIDENCE_PER_KEY = 10
  private readonly STRICT_MATCH_BONUS = 15
  private readonly TIMING_PRECISION_BONUS = 5

  /**
   * Process a frame and find matches
   */
  processFrame(
    frame: KeyboardFrame,
    holdPatterns: Map<string, PatternNode>,
    comboPatterns: Map<string, PatternNode>
  ): PatternMatchResult[] {
    const matches: PatternMatchResult[] = []

    // Process hold patterns
    for (const [key, node] of holdPatterns) {
      if (frame.heldKeys.has(key)) {
        this.checkHoldPattern(node, frame, matches)
      }
    }

    // Process combo patterns
    for (const [key, node] of comboPatterns) {
      if (frame.justPressed.has(key)) {
        this.checkComboPattern(node, frame, matches)
      }
    }

    // Process pattern progression
    this.progressActivePatterns(frame, matches)

    // Process pending matches that have exceeded grace period
    this.processPendingMatches(frame.timestamp, matches)

    // Cleanup expired states
    this.cleanupExpiredStates(frame.timestamp)

    return matches
  }

  private progressActivePatterns(frame: KeyboardFrame, matches: PatternMatchResult[]): void {
    for (const state of this.activeStates.values()) {
      // First check patterns at current node
      const nodeMatches = this.checkNodePatterns(state, frame)

      // Add matches to pending with grace period
      for (const match of nodeMatches) {
        this.addPendingMatch(match, frame.timestamp)
      }

      // Check child nodes for potential better matches
      const childMatches = this.checkChildNodes(state.currentNode, frame, state)
      for (const match of childMatches) {
        this.addPendingMatch(match, frame.timestamp)
      }
    }
  }

  private checkNodePatterns(state: PatternState, frame: KeyboardFrame): PatternMatchResult[] {
    const matches: PatternMatchResult[] = []

    for (const pattern of state.currentNode.patterns) {
      if (pattern.remainingSteps.length === 0) continue

      const nextStep = pattern.remainingSteps[0]
      const matchResult = this.evaluateStep(nextStep, frame, state)

      if (matchResult.isMatch) {
        const newState = this.progressState(state, matchResult, frame.timestamp)

        if (pattern.remainingSteps.length === 1) {
          // This was the last step
          matches.push({
            pattern: {
              ...pattern,
              remainingSteps: [],
              confidence: newState.confidence
            },
            state: newState,
            endTime: frame.timestamp
          })
        } else {
          // Update active state for continued matching
          this.activeStates.set(newState.patternId, newState)
        }
      }
    }

    return matches
  }

  private evaluateStep(
    step: { type: string; keys: string[]; conditions?: { strict?: boolean } },
    frame: KeyboardFrame,
    state: PatternState
  ): StepMatchResult {
    const isStrict = step.conditions?.strict ?? true
    let isMatch = false
    let matchedKeys = new Set<string>()

    switch (step.type) {
      case 'combo': {
        if (isStrict) {
          isMatch = step.keys.every((key) => frame.justPressed.has(key))
          if (isMatch) {
            matchedKeys = new Set(step.keys)
          }
        } else {
          isMatch = step.keys.every((key) => frame.justPressed.has(key) || frame.heldKeys.has(key))
          if (isMatch) {
            matchedKeys = new Set(
              step.keys.filter((key) => frame.justPressed.has(key) || frame.heldKeys.has(key))
            )
          }
        }
        break
      }

      case 'hold': {
        isMatch = step.keys.every((key) => frame.heldKeys.has(key))
        if (isMatch) {
          matchedKeys = new Set(step.keys)
        }
        break
      }
    }

    return {
      isMatch,
      isStrict,
      isComplete: isMatch && matchedKeys.size === step.keys.length,
      matchedKeys,
      timingScore: this.calculateTimingScore(state, frame.timestamp)
    }
  }

  private progressState(
    state: PatternState,
    matchResult: StepMatchResult,
    timestamp: number
  ): PatternState {
    const confidence = this.calculateConfidence(state, matchResult, timestamp)

    return {
      ...state,
      confidence,
      matchedKeys: new Set([...state.matchedKeys, ...matchResult.matchedKeys])
    }
  }

  private calculateConfidence(
    state: PatternState,
    matchResult: StepMatchResult,
    timestamp: number
  ): number {
    return Math.min(
      this.MAX_CONFIDENCE,
      state.confidence +
        matchResult.matchedKeys.size * this.BASE_CONFIDENCE_PER_KEY +
        (matchResult.isStrict ? this.STRICT_MATCH_BONUS : 0) +
        matchResult.timingScore * this.TIMING_PRECISION_BONUS
    )
  }

  private calculateTimingScore(state: PatternState, timestamp: number): number {
    const age = timestamp - state.startTime
    const window = state.currentNode.conditions.window

    // Score from 0-1 based on how close to optimal timing
    // Lower age = better score
    return Math.max(0, 1 - age / window)
  }

  private addPendingMatch(match: PatternMatchResult, timestamp: number): void {
    const existing = this.pendingMatches.get(match.pattern.id)

    // Only update if new match has higher confidence
    if (!existing || match.state.confidence > existing.result.state.confidence) {
      this.pendingMatches.set(match.pattern.id, {
        result: match,
        expiresAt: timestamp + this.EXECUTION_GRACE_PERIOD,
        priority: match.pattern.priority
      })
    }
  }

  private processPendingMatches(timestamp: number, matches: PatternMatchResult[]): void {
    for (const [id, pending] of this.pendingMatches) {
      if (timestamp >= pending.expiresAt) {
        matches.push(pending.result)
        this.pendingMatches.delete(id)
      }
    }
  }

  private checkChildNodes(
    node: PatternNode,
    frame: KeyboardFrame,
    parentState: PatternState
  ): PatternMatchResult[] {
    const matches: PatternMatchResult[] = []

    // Check each child node
    for (const [key, childNode] of node.children) {
      const matchResult = this.evaluateStep(
        { type: childNode.type, keys: childNode.keys, conditions: childNode.conditions },
        frame,
        parentState
      )

      if (matchResult.isMatch) {
        // Create new state for this child path
        const childState: PatternState = {
          patternId: `${parentState.patternId}-${key}`,
          currentNode: childNode,
          startTime: frame.timestamp,
          confidence: this.calculateConfidence(parentState, matchResult, frame.timestamp),
          matchedKeys: new Set([...parentState.matchedKeys, ...matchResult.matchedKeys])
        }

        // Check for completed patterns in this node
        for (const pattern of childNode.patterns) {
          if (pattern.remainingSteps.length === 0) {
            matches.push({
              pattern,
              state: childState,
              endTime: frame.timestamp
            })
          }
        }

        // Add to active states
        this.activeStates.set(childState.patternId, childState)
      }
    }

    return matches
  }

  private cleanupExpiredStates(timestamp: number): void {
    for (const [key, state] of this.activeStates) {
      const age = timestamp - state.startTime
      const window = state.currentNode.conditions.window

      if (age > window) {
        this.activeStates.delete(key)
      }
    }
  }

  /**
   * Reset all active states and pending matches
   */
  reset(): void {
    this.activeStates.clear()
    this.pendingMatches.clear()
  }

  private checkHoldPattern(
    node: PatternNode,
    frame: KeyboardFrame,
    matches: PatternMatchResult[]
  ): void {
    // Check if all keys in the node are held
    const matchResult = this.evaluateStep(
      { type: 'hold', keys: node.keys, conditions: node.conditions },
      frame,
      {
        patternId: '',
        currentNode: node,
        startTime: frame.timestamp,
        confidence: 0,
        matchedKeys: new Set()
      }
    )

    if (matchResult.isMatch) {
      // Get or create state
      const stateKey = `hold-${node.keys.join('-')}`
      let state = this.activeStates.get(stateKey)

      if (!state) {
        state = {
          patternId: stateKey,
          currentNode: node,
          startTime: frame.timestamp,
          confidence: 0,
          matchedKeys: new Set(node.keys)
        }
        this.activeStates.set(stateKey, state)
      }

      // Calculate hold duration
      const holdDuration = frame.timestamp - state.startTime

      // Check if hold time met
      if (holdDuration >= (node.conditions.holdTime ?? 0)) {
        // Update confidence based on hold duration and timing
        const newState = this.progressState(state, matchResult, frame.timestamp)

        // Check for completed patterns
        for (const pattern of node.patterns) {
          if (pattern.remainingSteps.length === 0) {
            this.addPendingMatch(
              {
                pattern,
                state: newState,
                endTime: frame.timestamp
              },
              frame.timestamp
            )
          }
        }
      }
    }
  }

  private checkComboPattern(
    node: PatternNode,
    frame: KeyboardFrame,
    matches: PatternMatchResult[]
  ): void {
    const matchResult = this.evaluateStep(
      { type: 'combo', keys: node.keys, conditions: node.conditions },
      frame,
      {
        patternId: '',
        currentNode: node,
        startTime: frame.timestamp,
        confidence: 0,
        matchedKeys: new Set()
      }
    )

    if (matchResult.isMatch) {
      // Create initial state
      const stateKey = `combo-${node.keys.join('-')}`
      const state: PatternState = {
        patternId: stateKey,
        currentNode: node,
        startTime: frame.timestamp,
        confidence: 0,
        matchedKeys: new Set(node.keys)
      }

      // Update state with match results
      const newState = this.progressState(state, matchResult, frame.timestamp)

      // Check for completed patterns
      for (const pattern of node.patterns) {
        if (pattern.remainingSteps.length === 0) {
          this.addPendingMatch(
            {
              pattern,
              state: newState,
              endTime: frame.timestamp
            },
            frame.timestamp
          )
        }
      }

      // Add to active states for potential child patterns
      this.activeStates.set(stateKey, newState)
    }
  }
}
