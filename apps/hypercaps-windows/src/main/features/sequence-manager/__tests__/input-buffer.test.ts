import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyboardFrameEvent } from '../../../service/keyboard/types'
import { InputBuffer } from '../input-buffer'

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

      buffer.tick(1500) // Move time forward
      expect(buffer.getEvents()).toEqual([]) // All events should be pruned
    })

    it('should ignore backwards time updates', () => {
      const frame = createFrameEvent(1, 1000)
      buffer.addFrame(frame)

      buffer.tick(500) // Try to move time backwards
      expect(buffer.getEvents()).toEqual([frame])
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

      buffer.addFrame(frame1)
      buffer.addFrame(frame2)

      expect(buffer.getEvents()).toEqual([frame2])
    })

    it('should handle rapid frame additions', () => {
      const frames = Array.from({ length: 100 }, (_, i) => createFrameEvent(i + 1, i * 10))

      frames.forEach((frame) => buffer.addFrame(frame))
      expect(buffer.getEvents().length).toBe(frames.length)
    })
  })
})
