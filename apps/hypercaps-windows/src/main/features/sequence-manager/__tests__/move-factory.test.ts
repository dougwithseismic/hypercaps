import { describe, it, expect, vi } from 'vitest'
import { moveFactory } from '../move-factory'
import type { MoveStep } from '../types'

describe('Move Factory', () => {
  it('should create a move with basic steps', () => {
    const steps: MoveStep[] = [
      { type: 'press', keys: ['down'], maxGapMs: 250 },
      { type: 'press', keys: ['right'], maxGapMs: 250 }
    ]

    const move = moveFactory('testMove', steps)

    expect(move.name).toBe('testMove')
    expect(move.steps).toEqual(steps)
    expect(move.onComplete).toBeUndefined()
    expect(move.onFail).toBeUndefined()
  })

  it('should create a move with callbacks', () => {
    const onComplete = vi.fn()
    const onFail = vi.fn()
    const steps: MoveStep[] = [{ type: 'press', keys: ['down'], maxGapMs: 250 }]

    const move = moveFactory('testMove', steps, onComplete, onFail)

    expect(move.onComplete).toBe(onComplete)
    expect(move.onFail).toBe(onFail)
  })

  it('should create a complex move with hold and hitConfirm steps', () => {
    const steps: MoveStep[] = [
      {
        type: 'hold',
        keys: ['down'],
        minHoldMs: 500,
        maxHoldMs: 1000,
        completeOnReleaseAfterMinHold: true
      },
      {
        type: 'press',
        keys: ['up', 'punch'],
        maxGapMs: 200,
        multiPressToleranceMs: 50
      },
      {
        type: 'hitConfirm',
        hitConfirmWindowMs: 300
      }
    ]

    const move = moveFactory('flashKick', steps)

    expect(move.name).toBe('flashKick')
    expect(move.steps).toEqual(steps)
    expect(move.steps[0].type).toBe('hold')
    expect(move.steps[1].type).toBe('press')
    expect(move.steps[2].type).toBe('hitConfirm')
  })
})
