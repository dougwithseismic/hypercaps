import { EventEmitter } from 'events'
import type {
  InputSequence,
  KeyboardFrame,
  StateStep,
  Step,
  SequenceState,
  SequenceHistory,
  SequenceRelationship
} from './types'

interface InputBuffer {
  frames: KeyboardFrame[]
  maxSize: number
  currentIndex: number
}

interface SequenceMatch {
  sequenceId: string
  confidence: number
  startFrame: number
  endFrame: number
  consumedInputs: Set<number>
  matchedKeys: Set<number>
}

export class SequenceStateTracker extends EventEmitter {
  private buffer: InputBuffer
  private activeMatches: Map<string, SequenceMatch>
  private sequences: Map<string, InputSequence>
  private sequenceHistory: SequenceHistory[] = []
  private debugEnabled = false
  private frameRate: number

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

    // First check sequence type matches
    const sequenceMatches = this.checkSequences(frame)
    matches.push(...sequenceMatches)

    // Then check state type sequences
    for (const [id, sequence] of this.sequences) {
      if (sequence.type === 'STATE') {
        const match = this.matchStateSequence(sequence)
        if (match) {
          matches.push(match)
        }
      }
    }

    // Emit events for all matches and update history
    for (const match of matches) {
      const sequence = this.sequences.get(match.sequenceId)
      if (!sequence) continue

      // Add to history before emitting
      this.sequenceHistory.push({
        id: match.sequenceId,
        timestamp: frame.timestamp,
        frameNumber: frame.frameNumber,
        duration: match.endFrame - match.startFrame
      })

      // Trim history to prevent memory growth
      if (this.sequenceHistory.length > 100) {
        this.sequenceHistory = this.sequenceHistory.slice(-100)
      }

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
    const sortedSequences = Array.from(this.sequences.entries()).sort(
      ([, a], [, b]) => (b.steps?.length || 0) - (a.steps?.length || 0)
    )

    for (const [id, sequence] of sortedSequences) {
      // Skip if we've already matched this sequence in this frame
      if (matches.some((m) => m.sequenceId === id)) continue

      const match = this.tryMatchSequence(sequence, frame)
      if (match) {
        // Check relationships before adding the match
        const canExecute = !sequence.relationships?.some((relationship) => {
          const targetHistory = this.sequenceHistory.find(
            (h) => h.sequenceId === relationship.targetSequenceId
          )
          if (!targetHistory) return relationship.type === 'REQUIRES'

          const timeSinceTarget = frame.timestamp - targetHistory.timestamp
          return relationship.type === 'REQUIRES'
            ? timeSinceTarget > relationship.timeWindowMs
            : timeSinceTarget <= relationship.timeWindowMs
        })

        if (canExecute) {
          matches.push(match)
          this.sequenceHistory.push({
            sequenceId: id,
            timestamp: frame.timestamp
          })
        }
      }
    }

    // Trim history to prevent memory growth
    while (this.sequenceHistory.length > 100) {
      this.sequenceHistory.shift()
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
    // Check relationships first if they exist
    if (sequence.relationships && sequence.relationships.length > 0) {
      const allRelationshipsValid = sequence.relationships.every((relationship) =>
        this.checkRelationship(relationship, frame.timestamp)
      )

      if (!allRelationshipsValid) {
        this.debug(`Sequence ${sequence.id} failed relationship checks`)
        return null
      }
    }

    // Check relationships before attempting to match
    if (!this.checkRelationships(sequence, frame)) {
      return null
    }

    if (sequence.type === 'STATE') {
      return this.matchStateSequence(sequence)
    }

    let currentStep = 0
    let matchStart = -1
    const consumedInputs = new Set<number>()
    const matchedKeys = new Set<number>()

    // Look through buffer for matching steps
    for (let i = 0; i < this.buffer.frames.length; i++) {
      const frame = this.buffer.frames[i]
      if (!frame) continue

      if (this.isInputConsumed(i)) continue

      const step = sequence.steps[currentStep]
      const stepMatch = this.matchesStep(frame, step)

      if (stepMatch.isMatch) {
        if (matchStart === -1) matchStart = i
        consumedInputs.add(i)
        stepMatch.matchedKeys.forEach((key) => matchedKeys.add(key))
        currentStep++

        if (currentStep === sequence.steps.length) {
          return {
            sequenceId: sequence.id,
            confidence: 1.0,
            startFrame: matchStart,
            endFrame: i,
            consumedInputs,
            matchedKeys
          }
        }
      }
    }

    return null
  }

  private matchStateSequence(sequence: StateStep): SequenceMatch | null {
    // Get existing match if any
    const existingMatch = this.activeMatches.get(sequence.id || 'unknown')
    const matchedKeys = new Set<number>()
    const consumedInputs = new Set<number>()
    let startFrame = existingMatch?.startFrame ?? -1
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
        match.matchedKeys.forEach((key) => matchedKeys.add(key))
      } else if (startFrame !== -1 && !this.isStatePartiallyMaintained(frame, sequence)) {
        // Only reset if we've lost the state completely and we're not in a trigger window
        const elapsed = frame.timestamp - startTime
        const inTriggerWindow =
          sequence.duration?.triggerMs &&
          Math.abs(elapsed - sequence.duration.triggerMs) <= (sequence.toleranceMs || 100)

        if (!inTriggerWindow) {
          this.debug(`Sequence ${sequence.id}: RESET - state lost at time ${frame.timestamp}`)
          startFrame = -1
          startTime = -1
          consumedInputs.clear()
          matchedKeys.clear()
        }
      }

      // Check if we've reached a trigger point
      if (startFrame !== -1 && sequence.duration) {
        const elapsed = frame.timestamp - startTime
        this.debug(
          `Sequence ${sequence.id}: elapsed=${elapsed}ms, startTime=${startTime}, currentTime=${frame.timestamp}`
        )

        // For triggerMs based sequences
        if (sequence.duration.triggerMs) {
          const tolerance = sequence.toleranceMs || 100
          const timeDiff = Math.abs(elapsed - sequence.duration.triggerMs)
          this.debug(
            `Sequence ${sequence.id}: triggerMs=${sequence.duration.triggerMs}, timeDiff=${timeDiff}, tolerance=${tolerance}`
          )

          if (timeDiff <= tolerance) {
            const sequenceMatch = {
              sequenceId: sequence.id || 'unknown',
              confidence: 1.0 - timeDiff / tolerance,
              startFrame,
              endFrame: i,
              consumedInputs,
              matchedKeys
            }

            // Only emit if we haven't already emitted this sequence at this trigger time
            const lastMatch = this.activeMatches.get(sequenceMatch.sequenceId)
            if (!lastMatch || Math.abs(lastMatch.endFrame - i) > 1) {
              this.debug(
                `Sequence ${sequence.id}: MATCHED at time ${frame.timestamp} with confidence ${sequenceMatch.confidence}`
              )
              this.activeMatches.set(sequenceMatch.sequenceId, sequenceMatch)
              return sequenceMatch
            } else {
              this.debug(`Sequence ${sequence.id}: SKIPPED - already matched recently`)
            }
          } else {
            this.debug(`Sequence ${sequence.id}: NOT MATCHED - outside tolerance`)
          }
        } else {
          // For duration range sequences
          if (
            elapsed >= (sequence.duration.minMs || 0) &&
            elapsed <= (sequence.duration.maxMs || Infinity)
          ) {
            const sequenceMatch = {
              sequenceId: sequence.id || 'unknown',
              confidence: 1.0,
              startFrame,
              endFrame: i,
              consumedInputs,
              matchedKeys
            }
            this.debug(`Sequence ${sequence.id}: MATCHED duration range at time ${frame.timestamp}`)
            this.activeMatches.set(sequenceMatch.sequenceId, sequenceMatch)
            return sequenceMatch
          }
        }
      }
    }

    return null
  }

  private matchesStep(
    frame: KeyboardFrame,
    step: Step
  ): { isMatch: boolean; matchedKeys: Set<number> } {
    if (step.type === 'STATE') {
      return this.matchesStateStep(frame, step)
    }
    return { isMatch: false, matchedKeys: new Set() }
  }

  private matchesStateStep(
    frame: KeyboardFrame,
    step: StateStep
  ): { isMatch: boolean; matchedKeys: Set<number> } {
    const matchedKeys = new Set<number>()

    // Check pressed keys
    if (step.pressed?.length) {
      const allPressed = step.pressed.every((key) => frame.justPressed.has(key))
      if (!allPressed) return { isMatch: false, matchedKeys }
      step.pressed.forEach((key) => matchedKeys.add(key))
    }

    // Check held keys
    if (step.held?.length) {
      const allHeld = step.held.every((key) => frame.heldKeys.has(key))
      if (!allHeld) return { isMatch: false, matchedKeys }
      step.held.forEach((key) => matchedKeys.add(key))
    }

    // Check released keys
    if (step.released?.length) {
      const allReleased = step.released.every((key) => frame.justReleased.has(key))
      if (!allReleased) return { isMatch: false, matchedKeys }
      step.released.forEach((key) => matchedKeys.add(key))
    }

    return { isMatch: true, matchedKeys }
  }

  private isInputConsumed(frameIndex: number): boolean {
    for (const match of this.activeMatches.values()) {
      if (match.consumedInputs.has(frameIndex)) return true
    }
    return false
  }

  private consumeInputs(frameIndices: Set<number>): void {
    // Only consume inputs for SEQUENCE type sequences
    // STATE type sequences can share inputs
    for (const index of frameIndices) {
      for (const [id, match] of this.activeMatches) {
        const sequence = this.sequences.get(id)
        if (sequence?.type === 'SEQUENCE') {
          match.consumedInputs.add(index)
        }
      }
    }
  }

  private cleanup(currentFrame: number): void {
    // Remove old matches that aren't active state sequences
    for (const [id, match] of this.activeMatches) {
      const sequence = this.sequences.get(id)
      if (sequence?.type === 'SEQUENCE' && match.endFrame < currentFrame - this.buffer.maxSize) {
        this.activeMatches.delete(id)
      }
    }

    // Clear old frames from buffer
    const oldestValidFrame = currentFrame - this.buffer.maxSize
    this.buffer.frames = this.buffer.frames.filter(
      (frame) => frame && frame.frameNumber >= oldestValidFrame
    )
  }

  private isStatePartiallyMaintained(frame: KeyboardFrame, step: StateStep): boolean {
    // For held keys, we want to be more lenient
    if (step.held?.length) {
      const someHeld = step.held.some((key) => frame.heldKeys.has(key))
      if (someHeld) return true
    }
    return false
  }

  private checkRelationships(sequence: InputSequence, frame: KeyboardFrame): boolean {
    if (!sequence.relationships) return true

    for (const relationship of sequence.relationships) {
      const isValid = this.checkRelationship(relationship, frame.timestamp)
      if (!isValid) {
        this.debug(
          `Sequence ${sequence.id}: Failed relationship check for ${relationship.targetSequenceId}`
        )
        return false
      }
    }

    return true
  }

  private checkRelationship(relationship: SequenceRelationship, currentTime: number): boolean {
    // Find the most recent completion of the target sequence
    const targetHistory = this.sequenceHistory.find((h) => h.id === relationship.targetSequenceId)

    if (relationship.type === 'REQUIRES') {
      // For REQUIRES, we need a recent completion within the time window
      if (!targetHistory) {
        this.debug(`Required sequence ${relationship.targetSequenceId} not found in history`)
        return false
      }
      const timeSinceCompletion = currentTime - targetHistory.timestamp
      const isValid = timeSinceCompletion <= relationship.timeWindowMs
      if (!isValid) {
        this.debug(
          `Required sequence ${relationship.targetSequenceId} was too old (${timeSinceCompletion}ms > ${relationship.timeWindowMs}ms)`
        )
      }
      return isValid
    } else if (relationship.type === 'PREVENTS') {
      // For PREVENTS, we must NOT have a recent completion within the time window
      if (!targetHistory) {
        return true
      }
      const timeSinceCompletion = currentTime - targetHistory.timestamp
      const isValid = timeSinceCompletion > relationship.timeWindowMs
      if (!isValid) {
        this.debug(
          `Prevented by sequence ${relationship.targetSequenceId} (${timeSinceCompletion}ms <= ${relationship.timeWindowMs}ms)`
        )
      }
      return isValid
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
