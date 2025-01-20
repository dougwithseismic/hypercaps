import { vi } from 'vitest'
import type { KeyboardFrameEvent } from '../../../../service/keyboard/types'

export const createFrameEvent = (
  frameNumber: number,
  timeOffset: number = 0
): KeyboardFrameEvent => {
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

// Mock keyboard service
export const mockKeyboardService = {
  on: vi.fn(),
  emit: vi.fn()
}
