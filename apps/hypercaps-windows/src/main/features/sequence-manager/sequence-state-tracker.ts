import { EventEmitter } from 'events'
import type { InputSequence, KeyboardFrame, SequenceHistory, StateStep, Step } from './types'

interface InputBuffer {
  frames: KeyboardFrame[]
  maxSize: number
  currentIndex: number
}

// Add new type for sequence states
type SequenceState = 'ACTIVE' | 'FAILED' | 'COMPLETE' | 'COOLDOWN'

interface SequenceMatch {
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
  state: SequenceState // Add state tracking
  cooldownUntil?: number // Add cooldown timestamp
}

export class SequenceStateTracker extends EventEmitter {
  private buffer: InputBuffer
  private activeMatches: Map<string, SequenceMatch>
  private sequences: Map<string, InputSequence>
  private consumedInputs: Set<string> = new Set() // now "frameIndex-key-sequenceId-state"
  private sequenceHistory: SequenceHistory[] = []
  private debugEnabled = false
  private frameRate: number
  private readonly DEFAULT_COOLDOWN_MS = 250 // Add default cooldown duration

  constructor(bufferSize: number = 15, frameRate: number = 60) {
    super()
    this.buffer = {
      frames: [],
      maxSize: bufferSize,
      currentIndex: 0
    }
    this.activeMatches = new Map()
    this.sequences = new Map()
    this.frameRate = frameRate
  }

  get registeredSequences(): Map<string, InputSequence> {
    return this.sequences
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled
  }

  private debug(message: string, ...args: any[]): void {
    if (this.debugEnabled) {
      console.log(`[SequenceStateTracker] ${message}`, ...args)
    }
  }

  setFrameRate(rate: number): void {
    this.frameRate = rate
  }

  addSequence(sequence: InputSequence): void {
    this.sequences.set(sequence.id, sequence)
    this.debug('Added sequence:', sequence)
  }

  removeSequence(id: string): void {
    this.sequences.delete(id)
    this.debug('Removed sequence:', { id })
  }

  removeAllSequences(): void {
    this.sequences.clear()
    this.activeMatches.clear()
    this.debug('Removed all sequences')
  }

  handleFrame(frame: KeyboardFrame): void {
    this.addFrame(frame)
    const matches: SequenceMatch[] = []

    // 1) Attempt matching all sequences
    const sequenceMatches = this.checkSequences(frame)
    matches.push(...sequenceMatches)

    // Emit events for all matches and update history
    for (const match of matches) {
      const sequence = this.sequences.get(match.sequenceId)
      if (!sequence) continue

      console.log('match', match)

      // Add to history before emitting
      this.sequenceHistory.push({
        id: match.sequenceId,
        timestamp: frame.timestamp,
        frameNumber: frame.frameNumber,
        duration: match.endFrame - match.startFrame
      })

      // Keep more history for complex sequence relationships
      if (this.sequenceHistory.length > 1000) {
        this.sequenceHistory = this.sequenceHistory.slice(-1000)
      }

      this.debug(`Added sequence ${match.sequenceId} to history at time ${frame.timestamp}`)

      this.emit('sequence:complete', {
        id: match.sequenceId,
        duration: match.endFrame - match.startFrame,
        startTime: match.startFrame,
        endTime: match.endFrame,
        confidence: match.confidence,
        matchedKeys: match.matchedKeys
      })
    }

    // Cleanup old matches and frames
    this.cleanup(frame.frameNumber)
  }

  private addFrame(frame: KeyboardFrame): void {
    this.buffer.frames[this.buffer.currentIndex] = frame
    this.buffer.currentIndex = (this.buffer.currentIndex + 1) % this.buffer.maxSize
    this.debug('Added frame:', frame)
  }

  private checkSequences(frame: KeyboardFrame): SequenceMatch[] {
    const matches: SequenceMatch[] = []
    const sortedSequences = Array.from(this.sequences.entries()).sort(([, a], [, b]) => {
      // Sort descending by "complexity" (# of steps)
      const aSteps = a.type === 'SEQUENCE' ? a.steps?.length || 0 : 0
      const bSteps = b.type === 'SEQUENCE' ? b.steps?.length || 0 : 0
      return bSteps - aSteps
    })

    for (const [id, sequence] of sortedSequences) {
      // Skip if we've already matched this sequence in this frame
      if (matches.some((m) => m.sequenceId === id)) continue

      const match = this.tryMatchSequence(sequence, frame)
      if (match) {
        matches.push(match)
      }
    }

    if (matches.length > 0) {
      this.emit(
        'sequenceMatched',
        matches.map((m) => m.sequenceId)
      )
    }

    return matches
  }

  private getComplexity(sequence: InputSequence): number {
    if (sequence.type === 'STATE') return 1
    return sequence.steps.reduce(
      (sum, step) =>
        sum + (step.type === 'SEQUENCE' ? this.getComplexity(step as InputSequence) : 1),
      0
    )
  }

  private tryMatchSequence(sequence: InputSequence, frame: KeyboardFrame): SequenceMatch | null {
    if (sequence.type === 'STATE') {
      const match = this.matchStateSequence(sequence)
      if (match) {
        // Consume inputs
        for (const frameIndex of match.consumedInputs) {
          this.consumeInputsForMatch(match, frameIndex)
        }
        return match
      }
      return null
    }

    let currentStep = 0
    let matchStart = -1
    const consumedInputs = new Set<number>()
    const matchedKeys = {
      pressed: new Set<number>(),
      held: new Set<number>(),
      released: new Set<number>()
    }

    // Look through buffer for matching steps
    for (let i = 0; i < this.buffer.frames.length; i++) {
      const frame = this.buffer.frames[i]
      if (!frame) continue

      // Check if any key is already consumed e.g. "frameIndex-key-sequenceId-state"
      const anyKeyConsumed = Array.from(frame.justPressed).some((key) =>
        this.isInputConsumed(i, key, 'pressed')
      )
      if (anyKeyConsumed) continue

      const step = sequence.steps[currentStep]
      const stepMatch = this.matchesStep(frame, step)

      if (stepMatch.isMatch) {
        if (matchStart === -1) matchStart = i
        consumedInputs.add(i)
        // Merge matched keys from each state
        stepMatch.matchedKeys.pressed.forEach((key) => matchedKeys.pressed.add(key))
        stepMatch.matchedKeys.held.forEach((key) => matchedKeys.held.add(key))
        stepMatch.matchedKeys.released.forEach((key) => matchedKeys.released.add(key))
        currentStep++

        if (currentStep === sequence.steps.length) {
          // Mark all matched inputs as consumed
          for (let j = matchStart; j <= i; j++) {
            const matchFrame = this.buffer.frames[j]
            if (matchFrame) {
              // Consume all matched keys from each state
              matchedKeys.pressed.forEach((key) => {
                this.consumeInput(j, key, sequence.id, 'pressed')
              })
              matchedKeys.held.forEach((key) => {
                this.consumeInput(j, key, sequence.id, 'held')
              })
              matchedKeys.released.forEach((key) => {
                this.consumeInput(j, key, sequence.id, 'released')
              })
            }
          }

          const match = {
            sequenceId: sequence.id,
            confidence: 1.0,
            startFrame: matchStart,
            endFrame: i,
            consumedInputs,
            matchedKeys,
            state: 'ACTIVE' as SequenceState
          }

          return match
        }
      }
    }
    return null
  }

  private matchStateSequence(sequence: StateStep): SequenceMatch | null {
    const sequenceId = sequence.id || 'unknown'
    const existingMatch = this.activeMatches.get(sequenceId)

    // Check if in cooldown or complete
    if (existingMatch?.cooldownUntil && existingMatch.cooldownUntil > Date.now()) {
      if (existingMatch.state === 'COOLDOWN' || existingMatch.state === 'COMPLETE') {
        return null
      }
    }

    // Only reset if failed (not if complete)
    if (existingMatch?.state === 'FAILED') {
      this.resetAllMatchesForSequence(sequenceId)
    }

    const matchedKeys = {
      pressed: new Set<number>(),
      held: new Set<number>(),
      released: new Set<number>()
    }
    const consumedInputs = new Set<number>()
    let startFrame = -1
    let startTime = -1

    // Find the first frame where the state is matched
    for (let i = 0; i < this.buffer.frames.length; i++) {
      const frame = this.buffer.frames[i]
      if (!frame) continue

      const match = this.matchesStateStep(frame, sequence)
      if (match.isMatch) {
        if (startFrame === -1) {
          startFrame = i
          startTime = frame.timestamp
        }
        consumedInputs.add(i)
        // Merge matched keys from each state
        match.matchedKeys.pressed.forEach((key) => matchedKeys.pressed.add(key))
        match.matchedKeys.held.forEach((key) => matchedKeys.held.add(key))
        match.matchedKeys.released.forEach((key) => matchedKeys.released.add(key))
      } else if (startFrame !== -1 && !this.isStatePartiallyMaintained(frame, sequence)) {
        // State is lost - check if we're in a valid trigger window before resetting
        const elapsed = frame.timestamp - startTime
        const inTriggerWindow =
          sequence.duration?.triggerMs &&
          Math.abs(elapsed - sequence.duration.triggerMs) <= (sequence.toleranceMs || 100)

        if (!inTriggerWindow) {
          this.debug(`Sequence ${sequenceId}: RESET - state lost at time ${frame.timestamp}`)
          this.emit('sequence:failed', {
            id: sequenceId,
            reason: 'state_lost',
            startTime
          })
          startFrame = -1
          startTime = -1
          consumedInputs.clear()
          matchedKeys.pressed.clear()
          matchedKeys.held.clear()
          matchedKeys.released.clear()
          this.resetPartialMatch(sequenceId)
        }
      }

      // Only check durations if we have a valid start time
      if (startFrame !== -1 && sequence.duration) {
        const elapsed = frame.timestamp - startTime
        this.debug(
          `Sequence ${sequenceId}: elapsed=${elapsed}ms, startTime=${startTime}, currentTime=${frame.timestamp}`
        )

        // 1. Check minMs first - fail early if not met
        if (sequence.duration.minMs && elapsed < sequence.duration.minMs) {
          continue // Keep checking frames
        }

        // 2. Check maxMs next - fail if exceeded
        if (sequence.duration.maxMs && elapsed > sequence.duration.maxMs) {
          this.debug(`Sequence ${sequenceId}: FAILED - exceeded maxMs`)
          this.emit('sequence:failed', {
            id: sequenceId,
            reason: 'duration_exceeded',
            startTime
          })
          this.resetPartialMatch(sequenceId)
          startFrame = -1
          startTime = -1
          consumedInputs.clear()
          matchedKeys.pressed.clear()
          matchedKeys.held.clear()
          matchedKeys.released.clear()
          continue
        }

        // 3. Check triggerMs last - only if previous checks pass
        if (sequence.duration.triggerMs) {
          const tolerance = sequence.toleranceMs || 100
          const timeDiff = Math.abs(elapsed - sequence.duration.triggerMs)

          if (timeDiff <= tolerance) {
            const sequenceMatch = {
              sequenceId,
              confidence: 1.0 - timeDiff / tolerance,
              startFrame,
              endFrame: i,
              consumedInputs,
              matchedKeys,
              state: 'COMPLETE' as SequenceState,
              cooldownUntil: Date.now() + this.DEFAULT_COOLDOWN_MS
            }

            // Only emit if we haven't already emitted this sequence at this trigger time
            const lastMatch = this.activeMatches.get(sequenceMatch.sequenceId)
            if (!lastMatch || Math.abs(lastMatch.endFrame - i) > 1) {
              this.debug(
                `Sequence ${sequenceId}: MATCHED at time ${frame.timestamp} with confidence ${sequenceMatch.confidence}`
              )

              // Reset all state for this sequence to prevent multiple triggers
              this.resetAllMatchesForSequence(sequenceId)
              this.activeMatches.set(sequenceMatch.sequenceId, sequenceMatch)

              // Add to history before returning
              this.sequenceHistory.push({
                id: sequenceId,
                timestamp: frame.timestamp,
                frameNumber: frame.frameNumber,
                duration: i - startFrame
              })

              return sequenceMatch
            }
          }
        } else {
          // 4. If no triggerMs, check if we're within minMs and maxMs
          if (
            (!sequence.duration.minMs || elapsed >= sequence.duration.minMs) &&
            (!sequence.duration.maxMs || elapsed <= sequence.duration.maxMs)
          ) {
            const sequenceMatch = {
              sequenceId,
              confidence: 1.0,
              startFrame,
              endFrame: i,
              consumedInputs,
              matchedKeys,
              state: 'COMPLETE' as SequenceState,
              cooldownUntil: Date.now() + this.DEFAULT_COOLDOWN_MS
            }

            this.debug(`Sequence ${sequenceId}: MATCHED duration range at time ${frame.timestamp}`)

            // Reset all state for this sequence
            this.resetAllMatchesForSequence(sequenceId)
            this.activeMatches.set(sequenceMatch.sequenceId, sequenceMatch)

            // Add to history before returning
            this.sequenceHistory.push({
              id: sequenceId,
              timestamp: frame.timestamp,
              frameNumber: frame.frameNumber,
              duration: i - startFrame
            })

            return sequenceMatch
          }
        }
      }
    }
    return null
  }

  private resetAllMatchesForSequence(sequenceId: string): void {
    // Clear active matches
    this.activeMatches.delete(sequenceId)

    // Clear consumed inputs
    this.consumedInputs = new Set(
      Array.from(this.consumedInputs).filter((key) => {
        const [, , consumedBySequence] = key.split('-')
        return consumedBySequence !== sequenceId
      })
    )

    // Clear any partial matches
    this.resetPartialMatch(sequenceId)

    this.debug(`Reset all matches for sequence ${sequenceId}`)
  }

  private matchesStep(
    frame: KeyboardFrame,
    step: Step
  ): {
    isMatch: boolean
    matchedKeys: {
      pressed: Set<number>
      held: Set<number>
      released: Set<number>
    }
  } {
    if (step.type === 'STATE') {
      return this.matchesStateStep(frame, step)
    }
    return {
      isMatch: false,
      matchedKeys: {
        pressed: new Set<number>(),
        held: new Set<number>(),
        released: new Set<number>()
      }
    }
  }

  private matchesStateStep(
    frame: KeyboardFrame,
    step: StateStep
  ): {
    isMatch: boolean
    matchedKeys: {
      pressed: Set<number>
      held: Set<number>
      released: Set<number>
    }
  } {
    const matchedKeys = {
      pressed: new Set<number>(),
      held: new Set<number>(),
      released: new Set<number>()
    }

    // Check pressed keys
    if (step.pressed?.length) {
      const allPressed = step.pressed.every((key) => frame.justPressed.has(key))
      if (!allPressed) return { isMatch: false, matchedKeys }
      step.pressed.forEach((key) => matchedKeys.pressed.add(key))
    }

    // Check held keys
    if (step.held?.length) {
      const allHeld = step.held.every((key) => frame.heldKeys.has(key))
      if (!allHeld) return { isMatch: false, matchedKeys }
      step.held.forEach((key) => matchedKeys.held.add(key))
    }

    // Check released keys
    if (step.released?.length) {
      const allReleased = step.released.every((key) => frame.justReleased.has(key))
      if (!allReleased) return { isMatch: false, matchedKeys }
      step.released.forEach((key) => matchedKeys.released.add(key))
    }

    return { isMatch: true, matchedKeys }
  }

  private consumeInputsForMatch(match: SequenceMatch, frameIndex: number): void {
    const matchFrame = this.buffer.frames[frameIndex]
    if (!matchFrame) return

    // Only consume pressed keys in their press frame
    match.matchedKeys.pressed.forEach((key) => {
      if (matchFrame.justPressed.has(key)) {
        this.consumeInput(frameIndex, key, match.sequenceId, 'pressed')
      }
    })

    // Only consume released keys in their release frame
    match.matchedKeys.released.forEach((key) => {
      if (matchFrame.justReleased.has(key)) {
        this.consumeInput(frameIndex, key, match.sequenceId, 'released')
      }
    })

    // Consume held keys in every frame they're held
    match.matchedKeys.held.forEach((key) => {
      if (matchFrame.heldKeys.has(key)) {
        this.consumeInput(frameIndex, key, match.sequenceId, 'held')
      }
    })
  }

  private consumeInput(
    frameIndex: number,
    key: number,
    sequenceId: string,
    state: 'pressed' | 'held' | 'released'
  ): void {
    // Only consume pressed/released events, allow held to be shared
    if (state === 'held') return

    // Store with state information: "frameIndex-key-sequenceId-state"
    this.consumedInputs.add(`${frameIndex}-${key}-${sequenceId}-${state}`)
    this.debug(`Consuming ${state} input at frame ${frameIndex}: ${key} for sequence ${sequenceId}`)
  }

  private isInputConsumed(
    frameIndex: number,
    key: number,
    state: 'pressed' | 'held' | 'released'
  ): boolean {
    // Allow held states to be shared between sequences
    if (state === 'held') return false

    return Array.from(this.consumedInputs).some((consumed) => {
      const [f, k, , s] = consumed.split('-')
      return f === frameIndex.toString() && k === key.toString() && s === state
    })
  }

  private resetPartialMatch(sequenceId: string): void {
    // Remove from activeMatches so partial progress is discarded
    this.activeMatches.delete(sequenceId)

    // Remove consumed inputs for this sequence
    this.consumedInputs = new Set(
      Array.from(this.consumedInputs).filter((key) => {
        const [, , consumedBySequence] = key.split('-')
        return consumedBySequence !== sequenceId
      })
    )

    this.debug(`Reset partial match for sequence ${sequenceId}`)
  }

  private cleanup(currentFrame: number): void {
    const now = Date.now()
    const oldestValidFrame = currentFrame - this.buffer.maxSize

    // Clear old matches and update states
    for (const [id, match] of this.activeMatches) {
      if (match.endFrame < oldestValidFrame) {
        this.resetAllMatchesForSequence(id)
      } else if (match.state === 'COOLDOWN' && match.cooldownUntil && match.cooldownUntil < now) {
        // Cooldown expired, remove the match
        this.resetAllMatchesForSequence(id)
      }
    }

    // Clear old inputs and frames
    this.consumedInputs = new Set(
      Array.from(this.consumedInputs).filter((key) => {
        const frameIndex = parseInt(key.split('-')[0])
        return frameIndex >= oldestValidFrame
      })
    )

    this.buffer.frames = this.buffer.frames.filter(
      (frame) => frame && frame.frameNumber >= oldestValidFrame
    )
  }

  private isStatePartiallyMaintained(frame: KeyboardFrame, step: StateStep): boolean {
    // For held keys, we must maintain ALL required keys
    if (step.held?.length) {
      const allHeldMaintained = step.held.every((key) => frame.heldKeys.has(key))
      if (!allHeldMaintained) return false
    }

    // For pressed keys, they must not be released until the state is complete
    if (step.pressed?.length) {
      const anyPressedReleased = step.pressed.some((key) => frame.justReleased.has(key))
      if (anyPressedReleased) return false
    }

    // For released keys, they must stay released
    if (step.released?.length) {
      const anyReleasedPressed = step.released.some((key) => frame.justPressed.has(key))
      if (anyReleasedPressed) return false
    }

    return true
  }

  dispose(): void {
    this.sequences.clear()
    this.activeMatches.clear()
    this.buffer.frames = []
    this.removeAllListeners()
  }
}
