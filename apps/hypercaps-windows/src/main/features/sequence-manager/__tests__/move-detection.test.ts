import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sequenceManager } from '../index'
import type { MoveDefinition } from '../types'

describe('Move Detection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Press Moves', () => {
    it('should detect a simple press move', () => {
      const onComplete = vi.fn()
      const move: MoveDefinition = {
        name: 'Simple Press',
        steps: [{ type: 'press', keys: ['a'], maxGapMs: 200 }],
        onComplete
      }

      sequenceManager.addMove(move)

      // Simulate pressing 'a'
      sequenceManager.update(100)

      expect(onComplete).toHaveBeenCalled()
    })

    it('should detect a multi-press move within tolerance', () => {
      const onComplete = vi.fn()
      const move: MoveDefinition = {
        name: 'Double Press',
        steps: [
          {
            type: 'press',
            keys: ['a', 'b'],
            maxGapMs: 200,
            multiPressToleranceMs: 50
          }
        ],
        onComplete
      }

      sequenceManager.addMove(move)

      // Simulate pressing 'a' and 'b' within tolerance
      sequenceManager.update(100)

      expect(onComplete).toHaveBeenCalled()
    })

    it('should fail a multi-press move outside tolerance', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'Double Press',
        steps: [
          {
            type: 'press',
            keys: ['a', 'b'],
            maxGapMs: 200,
            multiPressToleranceMs: 50
          }
        ],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate pressing 'a' and 'b' outside tolerance
      sequenceManager.update(100)
      vi.advanceTimersByTime(100)
      sequenceManager.update(200)

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })

    it('should detect a double shift press', () => {
      const onComplete = vi.fn()
      const move: MoveDefinition = {
        name: 'Double Shift',
        steps: [
          { type: 'press', keys: ['Shift'], maxGapMs: 1000 },
          { type: 'press', keys: ['Shift'], maxGapMs: 1000 }
        ],
        onComplete
      }

      sequenceManager.addMove(move)

      // Simulate first shift press
      sequenceManager.update(100)
      vi.advanceTimersByTime(500)
      // Simulate second shift press
      sequenceManager.update(600)

      expect(onComplete).toHaveBeenCalled()
    })

    it('should fail double shift if too slow', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'Double Shift',
        steps: [
          { type: 'press', keys: ['Shift'], maxGapMs: 1000 },
          { type: 'press', keys: ['Shift'], maxGapMs: 1000 }
        ],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate first shift press
      sequenceManager.update(100)
      vi.advanceTimersByTime(1200) // Too slow
      // Simulate second shift press
      sequenceManager.update(1300)

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })
  })

  describe('Hold Moves', () => {
    it('should detect a hold move', () => {
      const onComplete = vi.fn()
      const move: MoveDefinition = {
        name: 'Hold Move',
        steps: [{ type: 'hold', keys: ['a'], minHoldMs: 500 }],
        onComplete
      }

      sequenceManager.addMove(move)

      // Simulate holding 'a' for 600ms
      sequenceManager.update(100)
      vi.advanceTimersByTime(600)
      sequenceManager.update(700)

      expect(onComplete).toHaveBeenCalled()
    })

    it('should fail a hold move if released too early', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'Hold Move',
        steps: [{ type: 'hold', keys: ['a'], minHoldMs: 500 }],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate holding 'a' for 300ms
      sequenceManager.update(100)
      vi.advanceTimersByTime(300)
      sequenceManager.update(400)

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })

    it('should fail a hold move if held too long', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'Hold Move',
        steps: [{ type: 'hold', keys: ['a'], minHoldMs: 500, maxHoldMs: 1000 }],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate holding 'a' for 1100ms
      sequenceManager.update(100)
      vi.advanceTimersByTime(1100)
      sequenceManager.update(1200)

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })

    it('should detect Ctrl+Space hold for 3s', () => {
      const onComplete = vi.fn()
      const move: MoveDefinition = {
        name: 'Ctrl+Space 3s',
        steps: [
          {
            type: 'hold',
            keys: ['Control', 'Space'],
            minHoldMs: 3000,
            maxHoldMs: 5000,
            completeOnReleaseAfterMinHold: true
          }
        ],
        onComplete
      }

      sequenceManager.addMove(move)

      // Simulate holding for 4 seconds then releasing
      sequenceManager.update(100)
      vi.advanceTimersByTime(4000)
      sequenceManager.update(4100)

      expect(onComplete).toHaveBeenCalled()
    })

    it('should fail Ctrl+Space if released too early', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'Ctrl+Space 3s',
        steps: [
          {
            type: 'hold',
            keys: ['Control', 'Space'],
            minHoldMs: 3000,
            maxHoldMs: 5000,
            completeOnReleaseAfterMinHold: true
          }
        ],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate holding for 2 seconds then releasing (too early)
      sequenceManager.update(100)
      vi.advanceTimersByTime(2000)
      sequenceManager.update(2100)

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })
  })

  describe('Complex Moves', () => {
    it('should detect a QCF move', () => {
      const onComplete = vi.fn()
      const move: MoveDefinition = {
        name: 'QCF',
        steps: [
          { type: 'press', keys: ['down'], maxGapMs: 200 },
          { type: 'press', keys: ['downRight'], maxGapMs: 200 },
          { type: 'press', keys: ['right'], maxGapMs: 200 },
          { type: 'press', keys: ['punch'], maxGapMs: 300 }
        ],
        onComplete
      }

      sequenceManager.addMove(move)

      // Simulate QCF
      sequenceManager.update(100) // down
      vi.advanceTimersByTime(100)
      sequenceManager.update(200) // downRight
      vi.advanceTimersByTime(100)
      sequenceManager.update(300) // right
      vi.advanceTimersByTime(100)
      sequenceManager.update(400) // punch

      expect(onComplete).toHaveBeenCalled()
    })

    it('should fail a QCF move if too slow', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'QCF',
        steps: [
          { type: 'press', keys: ['down'], maxGapMs: 200 },
          { type: 'press', keys: ['downRight'], maxGapMs: 200 },
          { type: 'press', keys: ['right'], maxGapMs: 200 },
          { type: 'press', keys: ['punch'], maxGapMs: 300 }
        ],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate slow QCF
      sequenceManager.update(100) // down
      vi.advanceTimersByTime(300)
      sequenceManager.update(400) // downRight (too slow)

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })

    it('should detect Hold G + Triple H tap', () => {
      const onComplete = vi.fn()
      const move: MoveDefinition = {
        name: 'Hold G + Triple H',
        steps: [
          {
            type: 'hold',
            keys: ['G'],
            minHoldMs: 0,
            completeOnReleaseAfterMinHold: false
          },
          { type: 'press', keys: ['H'], maxGapMs: 500 },
          { type: 'press', keys: ['H'], maxGapMs: 500 },
          { type: 'press', keys: ['H'], maxGapMs: 500 }
        ],
        onComplete
      }

      sequenceManager.addMove(move)

      // Simulate holding G and tapping H three times
      sequenceManager.update(100) // Hold G
      vi.advanceTimersByTime(100)
      sequenceManager.update(200) // First H tap
      vi.advanceTimersByTime(200)
      sequenceManager.update(400) // Second H tap
      vi.advanceTimersByTime(200)
      sequenceManager.update(600) // Third H tap

      expect(onComplete).toHaveBeenCalled()
    })

    it('should fail Hold G + Triple H if H taps too slow', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'Hold G + Triple H',
        steps: [
          {
            type: 'hold',
            keys: ['G'],
            minHoldMs: 0,
            completeOnReleaseAfterMinHold: false
          },
          { type: 'press', keys: ['H'], maxGapMs: 500 },
          { type: 'press', keys: ['H'], maxGapMs: 500 },
          { type: 'press', keys: ['H'], maxGapMs: 500 }
        ],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate holding G and tapping H too slowly
      sequenceManager.update(100) // Hold G
      vi.advanceTimersByTime(100)
      sequenceManager.update(200) // First H tap
      vi.advanceTimersByTime(600) // Too slow
      sequenceManager.update(800) // Second H tap (too late)

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })

    it('should fail Hold G + Triple H if G released early', () => {
      const onComplete = vi.fn()
      const onFail = vi.fn()
      const move: MoveDefinition = {
        name: 'Hold G + Triple H',
        steps: [
          {
            type: 'hold',
            keys: ['G'],
            minHoldMs: 0,
            completeOnReleaseAfterMinHold: false
          },
          { type: 'press', keys: ['H'], maxGapMs: 500 },
          { type: 'press', keys: ['H'], maxGapMs: 500 },
          { type: 'press', keys: ['H'], maxGapMs: 500 }
        ],
        onComplete,
        onFail
      }

      sequenceManager.addMove(move)

      // Simulate releasing G too early
      sequenceManager.update(100) // Hold G
      vi.advanceTimersByTime(100)
      sequenceManager.update(200) // First H tap
      vi.advanceTimersByTime(100)
      sequenceManager.update(300) // Release G too early
      vi.advanceTimersByTime(100)
      sequenceManager.update(400) // Second H tap

      expect(onComplete).not.toHaveBeenCalled()
      expect(onFail).toHaveBeenCalled()
    })
  })
})
