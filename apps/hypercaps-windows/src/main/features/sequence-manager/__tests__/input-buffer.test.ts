import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyboardFrameEvent } from '../../../service/keyboard/types'
import { InputBuffer, buildFrameInputFromBuffer } from '../input-buffer'

describe('InputBuffer', () => {
  let buffer: InputBuffer
  const TIME_WINDOW_MS = 1000 // 1 second window

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0) // Start at 0
    buffer = new InputBuffer(TIME_WINDOW_MS)
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

  describe('addFrame', () => {
    it('should add a frame to an empty buffer', () => {
      const frame = createFrameEvent(1)
      buffer.addFrame(frame)
      expect(buffer.getEvents()).toEqual([frame])
    })

    it('should maintain chronological order of frames', () => {
      const frame1 = createFrameEvent(1)
      const frame2 = createFrameEvent(2, 100)
      const frame3 = createFrameEvent(3, 200)

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)
      buffer.addFrame(frame3)

      expect(buffer.getEvents()).toEqual([frame1, frame2, frame3])
    })

    it('should throw error for out-of-order frames', () => {
      const frame2 = createFrameEvent(2)
      const frame1 = createFrameEvent(1)

      buffer.addFrame(frame2)
      expect(() => buffer.addFrame(frame1)).toThrow(/out of order/)
    })

    it('should throw error for duplicate frame numbers', () => {
      const frame1a = createFrameEvent(1)
      const frame1b = createFrameEvent(1, 100)

      buffer.addFrame(frame1a)
      expect(() => buffer.addFrame(frame1b)).toThrow(/out of order/)
    })
  })

  describe('time window management', () => {
    it('should prune events outside the time window', () => {
      const frame1 = createFrameEvent(1, 0)
      const frame2 = createFrameEvent(2, 500)
      const frame3 = createFrameEvent(3, 1100) // Outside window

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)
      buffer.addFrame(frame3)

      expect(buffer.getEvents()).toEqual([frame2, frame3])
    })

    it('should handle tick updates correctly', () => {
      const frame1 = createFrameEvent(1, 0)
      const frame2 = createFrameEvent(2, 500)

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)

      vi.advanceTimersByTime(5000)

      buffer.tick(5000) // Move time forward
      expect(buffer.getEvents()).toEqual([]) // All events should be pruned
    })

    it('should ignore backwards time updates', () => {
      const frame = createFrameEvent(1, 1000)
      buffer.addFrame(frame)

      buffer.tick(500) // Try to move time backwards
      expect(buffer.getEvents()).toEqual([frame])
    })
  })

  describe('buildFrameInputFromBuffer', () => {
    it('should build frame input from a single press', () => {
      const frame = createFrameEvent(1)
      frame.state.justPressed = ['a']
      buffer.addFrame(frame)

      const input = buildFrameInputFromBuffer(buffer, frame.timestamp)
      expect(input.justPressed['a']).toBe(frame.timestamp)
      expect(input.currentlyHeld).toContain('a')
      expect(input.holdDuration['a']).toBe(0)
    })

    it('should track hold durations', () => {
      const frame1 = createFrameEvent(1, 0)
      frame1.state.justPressed = ['a']

      const frame2 = createFrameEvent(2, 100)
      frame2.state.held = ['a']

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)

      const input = buildFrameInputFromBuffer(buffer, frame2.timestamp)
      expect(input.currentlyHeld).toContain('a')
      expect(input.holdDuration['a']).toBe(100)
    })

    it('should handle releases', () => {
      const frame1 = createFrameEvent(1, 0)
      frame1.state.justPressed = ['a']

      const frame2 = createFrameEvent(2, 100)
      frame2.state.justReleased = ['a']

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)

      const input = buildFrameInputFromBuffer(buffer, frame2.timestamp)
      expect(input.justReleased).toContain('a')
      expect(input.currentlyHeld).not.toContain('a')
      expect(input.holdDuration['a']).toBeUndefined()
    })

    it('should handle multiple keys', () => {
      const frame1 = createFrameEvent(1, 0)
      frame1.state.justPressed = ['a', 'b']

      const frame2 = createFrameEvent(2, 50)
      frame2.state.held = ['a', 'b']

      const frame3 = createFrameEvent(3, 100)
      frame3.state.justReleased = ['a']
      frame3.state.held = ['b']

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)
      buffer.addFrame(frame3)

      const input = buildFrameInputFromBuffer(buffer, frame3.timestamp)
      expect(input.justReleased).toContain('a')
      expect(input.currentlyHeld).toContain('b')
      expect(input.currentlyHeld).not.toContain('a')
      expect(input.holdDuration['b']).toBe(100)
    })

    it('should only include events within frame duration', () => {
      const frame1 = createFrameEvent(1, 0)
      frame1.state.justPressed = ['a']

      const frame2 = createFrameEvent(2, 50) // Within 16.67ms
      frame2.state.justPressed = ['b']

      const frame3 = createFrameEvent(3, 100) // Outside 16.67ms
      frame3.state.justPressed = ['c']

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)
      buffer.addFrame(frame3)

      const input = buildFrameInputFromBuffer(buffer, frame3.timestamp)
      expect(input.justPressed['c']).toBe(frame3.timestamp)
      expect(input.justPressed['b']).toBeUndefined()
      expect(input.justPressed['a']).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('should reset buffer state', () => {
      const frame1 = createFrameEvent(1)
      const frame2 = createFrameEvent(2, 100)

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)
      buffer.clear()

      expect(buffer.getEvents()).toEqual([])

      // Should be able to add frames starting from any frame number after clear
      const newFrame1 = createFrameEvent(1, 200)
      expect(() => buffer.addFrame(newFrame1)).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle events exactly at the time window boundary', () => {
      const frame1 = createFrameEvent(1, 0)
      const frame2 = createFrameEvent(2, TIME_WINDOW_MS)

      vi.advanceTimersByTime(TIME_WINDOW_MS)

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)

      expect(buffer.getEvents()).toEqual([frame1, frame2])
    })

    it('should handle rapid frame additions', () => {
      const frames = Array.from({ length: 100 }, (_, i) => createFrameEvent(i + 1, i * 10))

      frames.forEach((frame) => buffer.addFrame(frame))
      expect(buffer.getEvents().length).toBe(frames.length)
    })
  })
})
