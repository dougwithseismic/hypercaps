import { EventEmitter } from 'events'
import type {
  InputSequence,
  KeyboardFrame,
  SequenceHistory,
  SequenceRelationship,
  StateStep,
  Step
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
  private consumedInputs: Set<string> = new Set() // now "frameIndex-key-sequenceId"
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

    // 1) Attempt matching all sequences
    const sequenceMatches = this.checkSequences(frame)
    matches.push(...sequenceMatches)

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
        // Consume inputs even if relationships block the sequence
        for (const frameIndex of match.consumedInputs) {
          const matchFrame = this.buffer.frames[frameIndex]
          if (matchFrame) {
            matchFrame.justPressed.forEach((key) => {
              this.consumeInput(frameIndex, key, sequence.id)
            })
          }
        }

        // Check relationships after consuming inputs
        if (!this.checkRelationships(sequence, frame)) {
          this.resetPartialMatch(sequence.id)
          this.emit('sequence:failed', {
            id: sequence.id,
            reason: 'wrong_order',
            startTime: match.startFrame
          })
          return null
        }
        return match
      }
      return null
    }

    let currentStep = 0
    let matchStart = -1
    const consumedInputs = new Set<number>()
    const matchedKeys = new Set<number>()

    // Look through buffer for matching steps
    for (let i = 0; i < this.buffer.frames.length; i++) {
      const frame = this.buffer.frames[i]
      if (!frame) continue

      // Check if any key is already consumed e.g. "frameIndex-key-sequenceId"
      const anyKeyConsumed = Array.from(frame.justPressed).some((key) =>
        this.isInputConsumed(i, key)
      )
      if (anyKeyConsumed) continue

      const step = sequence.steps[currentStep]
      const stepMatch = this.matchesStep(frame, step)

      if (stepMatch.isMatch) {
        if (matchStart === -1) matchStart = i
        consumedInputs.add(i)
        stepMatch.matchedKeys.forEach((key) => matchedKeys.add(key))
        currentStep++

        if (currentStep === sequence.steps.length) {
          // Mark all matched inputs as consumed
          for (let j = matchStart; j <= i; j++) {
            const matchFrame = this.buffer.frames[j]
            if (matchFrame) {
              matchFrame.justPressed.forEach((key) => {
                this.consumeInput(j, key, sequence.id)
              })
            }
          }

          const match = {
            sequenceId: sequence.id,
            confidence: 1.0,
            startFrame: matchStart,
            endFrame: i,
            consumedInputs,
            matchedKeys
          }

          // Check relationships after consuming inputs
          if (!this.checkRelationships(sequence, frame)) {
            this.resetPartialMatch(sequence.id)
            this.emit('sequence:failed', {
              id: sequence.id,
              reason: 'wrong_order',
              startTime: matchStart
            })
            return null
          }

          return match
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

  private isInputConsumed(frameIndex: number, key: number): boolean {
    // Return true if we find any consumed key matching frameIndex-key
    // Now we store them as: frameIndex-key-sequenceId
    return Array.from(this.consumedInputs).some((consumed) => {
      const [f, consumedKey /*, seqId*/] = consumed.split('-')
      return f === frameIndex.toString() && consumedKey === key.toString()
    })
  }

  private consumeInput(frameIndex: number, key: number, sequenceId: string): void {
    // Store also the sequenceId so we can un-consume it if that partial match is reset
    this.consumedInputs.add(`${frameIndex}-${key}-${sequenceId}`)
    this.debug(`Consuming input at frame ${frameIndex}: ${key} for sequence ${sequenceId}`)
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
    // Remove old matches that aren't active state sequences
    for (const [id, match] of this.activeMatches) {
      const sequence = this.sequences.get(id)
      if (sequence?.type === 'SEQUENCE' && match.endFrame < currentFrame - this.buffer.maxSize) {
        this.activeMatches.delete(id)
      }
    }

    // Clear old consumed inputs
    const oldestValidFrame = currentFrame - this.buffer.maxSize
    this.consumedInputs = new Set(
      Array.from(this.consumedInputs).filter((key) => {
        const frameIndex = parseInt(key.split('-')[0])
        return frameIndex >= oldestValidFrame
      })
    )

    // Clear old frames from buffer
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
    // Find the most recent completion of the target sequence by searching from the end
    const targetHistory = [...this.sequenceHistory]
      .reverse()
      .find((h) => h.id === relationship.targetSequenceId)

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
        this.debug(`No preventing sequence ${relationship.targetSequenceId} found in history`)
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
