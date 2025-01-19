import { KeyboardFrame } from '@hypercaps/keyboard-monitor'
import { randomUUID } from 'crypto'
import { KeyboardFrameEvent } from '../types'

export const validateFrame = (frame: KeyboardFrame): string[] => {
  const validations = [
    {
      check: () => !frame.timestamp,
      message: 'Frame missing timestamp'
    },
    {
      check: () => !frame.state,
      message: 'Frame missing state'
    },
    {
      check: () => frame.state && !Array.isArray(frame.state.justPressed),
      message: 'Invalid justPressed state'
    },
    {
      check: () => frame.state && !Array.isArray(frame.state.held),
      message: 'Invalid held state'
    },
    {
      check: () => frame.state && !Array.isArray(frame.state.justReleased),
      message: 'Invalid justReleased state'
    },
    {
      check: () => frame.state && typeof frame.state.holdDurations !== 'object',
      message: 'Invalid holdDurations state'
    }
  ]

  return validations
    .filter((validation) => validation.check())
    .map((validation) => validation.message)
}

export const processFrame = (frame: KeyboardFrame): KeyboardFrameEvent => {
  const validationErrors = validateFrame(frame)

  const processedFrame: KeyboardFrameEvent = {
    ...frame,
    id: randomUUID(),
    processed: true,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    frameTimestamp: frame.timestamp,
    state: {
      justPressed: frame.state.justPressed.map((key) => String(key)),
      held: frame.state.held.map((key) => String(key)),
      justReleased: frame.state.justReleased.map((key) => String(key)),
      holdDurations: frame.state.holdDurations,
      frameNumber: frame.frameNumber,
      timestamp: frame.timestamp
    }
  }

  return processedFrame
}
