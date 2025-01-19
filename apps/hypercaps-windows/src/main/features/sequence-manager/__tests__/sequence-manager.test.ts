import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sequenceManager } from '../index'
import type { KeyboardFrameEvent } from '../../../service/keyboard/types'
import { keyboardService } from '../../../service/keyboard/keyboard-service'
import type { MoveDefinition } from '../types'
import { sequenceStore } from '../store'

describe('SequenceManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createFrameEvent = (frameNumber: number, timeOffset: number = 0): KeyboardFrameEvent => {
    const now = Number(vi.getMockedSystemTime()) + timeOffset
    return {
      id: `frame-${frameNumber}`,
      frameNumber,
      timestamp: now,
      frameTimestamp: now,
      processed: false,
      gateOpen: true,
      validationErrors: undefined,
      state: {
        timestamp: now,
        frameNumber,
        justPressed: [],
        held: [],
        justReleased: [],
        holdDurations: {}
      },
      event: {
        type: 'keydown',
        key: ''
      }
    }
  }

  describe('Initialization', () => {
    it('should initialize correctly', () => {
      sequenceManager.initialize()
      expect(sequenceManager).toBeDefined()
    })

    it('should not initialize twice', () => {
      const spy = vi.spyOn(keyboardService, 'on')
      sequenceManager.initialize()
      sequenceManager.initialize()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Move Management', () => {
    it('should add moves correctly', () => {
      const move: MoveDefinition = {
        name: 'Test Move',
        steps: [{ type: 'press', keys: ['a'], maxGapMs: 200 }]
      }

      sequenceManager.addMove(move)
      // Since moves is private, we can only test indirectly via behavior
      const onComplete = vi.fn()
      move.onComplete = onComplete

      // Simulate the move
      sequenceManager.update(100)
      expect(onComplete).toHaveBeenCalled()
    })

    it('should handle multiple moves concurrently', () => {
      const move1Complete = vi.fn()
      const move2Complete = vi.fn()

      const move1: MoveDefinition = {
        name: 'Move 1',
        steps: [{ type: 'press', keys: ['a'], maxGapMs: 200 }],
        onComplete: move1Complete
      }

      const move2: MoveDefinition = {
        name: 'Move 2',
        steps: [{ type: 'press', keys: ['b'], maxGapMs: 200 }],
        onComplete: move2Complete
      }

      sequenceManager.addMove(move1)
      sequenceManager.addMove(move2)

      // Simulate both moves
      sequenceManager.update(100)

      expect(move1Complete).toHaveBeenCalled()
      expect(move2Complete).toHaveBeenCalled()
    })
  })

  describe('Event Handling', () => {
    it('should handle keyboard frame events', () => {
      const move: MoveDefinition = {
        name: 'Test Move',
        steps: [{ type: 'press', keys: ['a'], maxGapMs: 200 }],
        onComplete: vi.fn()
      }

      sequenceManager.addMove(move)
      sequenceManager.initialize()

      // Simulate keyboard frame event
      const frame = createFrameEvent(1)
      keyboardService.emit('keyboard:frame', frame)

      expect(move.onComplete).toHaveBeenCalled()
    })

    it('should emit move events', () => {
      const completeListener = vi.fn()
      const failListener = vi.fn()

      sequenceManager.on('move:complete', completeListener)
      sequenceManager.on('move:fail', failListener)

      const move: MoveDefinition = {
        name: 'Test Move',
        steps: [{ type: 'press', keys: ['a'], maxGapMs: 200 }]
      }

      sequenceManager.addMove(move)

      // Simulate successful move
      sequenceManager.update(100)
      expect(completeListener).toHaveBeenCalledWith({ name: 'Test Move' })

      // Simulate failed move
      vi.advanceTimersByTime(300)
      sequenceManager.update(400)
      expect(failListener).toHaveBeenCalledWith({
        name: 'Test Move',
        reason: 'timeout',
        step: 0
      })
    })
  })

  describe('Store Integration', () => {
    it('should respect store enabled state', () => {
      const move: MoveDefinition = {
        name: 'Test Move',
        steps: [{ type: 'press', keys: ['a'], maxGapMs: 200 }],
        onComplete: vi.fn()
      }

      sequenceManager.addMove(move)
      sequenceManager.initialize()

      // Disable via store
      sequenceStore.update({
        update: (config) => {
          config.isEnabled = false
        }
      })

      // Simulate move
      sequenceManager.update(100)
      expect(move.onComplete).not.toHaveBeenCalled()

      // Re-enable
      sequenceStore.update({
        update: (config) => {
          config.isEnabled = true
        }
      })

      // Simulate move again
      sequenceManager.update(200)
      expect(move.onComplete).toHaveBeenCalled()
    })
  })
})
