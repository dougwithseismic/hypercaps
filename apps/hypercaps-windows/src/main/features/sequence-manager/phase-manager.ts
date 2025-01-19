import { EventEmitter } from 'events'
import type { ExecutionPhase, PhaseTiming, PhaseState } from './types'

const DEFAULT_TIMING: Required<PhaseTiming> = {
  startupMs: 100,
  activeMs: 100,
  recoveryMs: 200,
  toleranceMs: 50
}

type PhaseTransitionMap = {
  [K in ExecutionPhase]?: ExecutionPhase[]
}

export class PhaseManager extends EventEmitter {
  private timing: Required<PhaseTiming>
  private state: PhaseState
  private readonly validTransitions: PhaseTransitionMap = {
    idle: ['startup'],
    startup: ['active', 'failed'],
    active: ['recovery', 'failed'],
    recovery: ['complete', 'failed'],
    complete: ['idle'],
    failed: ['idle']
  }
  private startTime: number = 0

  constructor(timing: PhaseTiming = {}) {
    super()
    this.timing = { ...DEFAULT_TIMING, ...timing }
    this.state = this.createInitialState()
  }

  private createInitialState(): PhaseState {
    return {
      currentPhase: 'idle',
      phaseStartTime: 0,
      phaseElapsedMs: 0,
      phaseDurationMs: 0
    }
  }

  public getCurrentPhase(): ExecutionPhase {
    return this.state.currentPhase
  }

  public getPhaseState(): PhaseState {
    return { ...this.state }
  }

  public start(timestamp: number = Date.now()): void {
    this.startTime = timestamp
    this.transitionTo('startup', timestamp)
  }

  public reset(): void {
    this.startTime = 0
    this.state = this.createInitialState()
  }

  public update(timestamp: number): void {
    const currentPhase = this.state.currentPhase

    // If we are in idle/complete/failed, no further phase updates.
    if (currentPhase === 'idle' || currentPhase === 'complete' || currentPhase === 'failed') {
      return
    }

    // Calculate elapsed time since *this phase* began.
    const elapsed = timestamp - this.state.phaseStartTime
    this.state.phaseElapsedMs = elapsed

    const currentPhaseDuration = this.getPhaseDuration(currentPhase)
    const minTime = currentPhaseDuration - this.timing.toleranceMs
    const maxTime = currentPhaseDuration + this.timing.toleranceMs

    // -- 1) Too early => fail
    if (elapsed < minTime && elapsed >= 0) {
      this.handleFailure('phase_timeout', elapsed)
      return
    }

    // -- 2) On-time => transition
    if (elapsed >= minTime && elapsed <= maxTime) {
      // Normal transition to the next phase
      switch (currentPhase) {
        case 'startup':
          this.transitionTo('active', timestamp)
          break
        case 'active':
          this.transitionTo('recovery', timestamp)
          break
        case 'recovery': {
          const totalDuration = timestamp - this.startTime
          this.transitionTo('complete', timestamp)
          this.emit('complete', {
            totalDuration,
            finalPhase: 'complete'
          })
          break
        }
      }
    }
    // -- 3) Too late => fail
    else if (elapsed > maxTime) {
      this.handleFailure('phase_timeout', elapsed)
      return
    }
  }

  private transitionTo(phase: ExecutionPhase, timestamp: number): void {
    const validNextPhases = this.validTransitions[this.state.currentPhase]
    if (!validNextPhases?.includes(phase)) {
      throw new Error(`Invalid phase transition from ${this.state.currentPhase} to ${phase}`)
    }

    const previousPhase = this.state.currentPhase
    this.state.currentPhase = phase
    this.state.phaseStartTime = timestamp
    this.state.phaseElapsedMs = 0
    this.state.phaseDurationMs = this.getPhaseDuration(phase)

    if (phase !== 'failed') {
      this.emit('phaseChange', {
        previousPhase,
        currentPhase: phase,
        timestamp,
        elapsedMs: timestamp - this.startTime
      })
    }
  }

  private getPhaseDuration(phase: ExecutionPhase): number {
    switch (phase) {
      case 'startup':
        return this.timing.startupMs
      case 'active':
        return this.timing.activeMs
      case 'recovery':
        return this.timing.recoveryMs
      default:
        return 0
    }
  }

  private handleFailure(reason: 'phase_timeout', elapsedMs: number): void {
    const failedPhase = this.state.currentPhase
    this.state.currentPhase = 'failed'
    this.state.phaseDurationMs = 0

    this.emit('failed', {
      reason,
      phase: failedPhase,
      elapsedMs
    })
  }
}
