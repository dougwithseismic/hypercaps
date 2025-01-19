import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PhaseManager } from './phase-manager'
import type { PhaseTiming } from './types'

describe('PhaseManager', () => {
  let phaseManager: PhaseManager

  beforeEach(() => {
    vi.useFakeTimers()
    phaseManager = new PhaseManager()
  })

  describe('Initial State', () => {
    it('should start in idle phase', () => {
      expect(phaseManager.getCurrentPhase()).toBe('idle')
    })

    it('should have zero elapsed time initially', () => {
      const state = phaseManager.getPhaseState()
      expect(state.phaseElapsedMs).toBe(0)
      expect(state.phaseStartTime).toBe(0)
    })
  })

  describe('Basic Phase Transitions', () => {
    it('should transition from idle to startup when started', () => {
      const timestamp = 1000
      phaseManager.start(timestamp)
      expect(phaseManager.getCurrentPhase()).toBe('startup')
      expect(phaseManager.getPhaseState().phaseStartTime).toBe(timestamp)
    })
  })
})
