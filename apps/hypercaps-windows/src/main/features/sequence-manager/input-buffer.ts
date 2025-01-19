import type { KeyboardFrameEvent } from '../../service/keyboard/types'

/**
 * A rolling window buffer to store recent keyboard frame events.
 * Events are stored in chronological order (oldest to newest).
 * Maintains a time-based window of recent events.
 *
 * Example usage:
 *   const buffer = new InputBuffer(2000) // keep the last 2 seconds of inputs
 *   buffer.addFrame(frameEvent)
 */
export class InputBuffer {
  private events: KeyboardFrameEvent[] = []
  private readonly timeWindowMs: number
  private lastFrameNumber: number = -1
  private currentTime: number = 0

  constructor(timeWindowMs: number) {
    this.timeWindowMs = timeWindowMs
  }

  /**
   * Add a single frame event to the buffer.
   * Validates frame ordering and updates time tracking.
   * @throws Error if frame is out of order
   */
  addFrame(frame: KeyboardFrameEvent): void {
    if (frame.frameNumber <= this.lastFrameNumber) {
      throw new Error(
        `Frame number ${frame.frameNumber} is out of order. Last frame was ${this.lastFrameNumber}`
      )
    }

    // Update our time tracking
    if (frame.timestamp > this.currentTime) {
      this.currentTime = frame.timestamp
    }

    this.events.push(frame)
    this.lastFrameNumber = frame.frameNumber
    this.prune()
  }

  /**
   * Removes events older than the time window.
   * Uses the current time as reference.
   */
  private prune(): void {
    const cutoffTime = this.currentTime - this.timeWindowMs
    const firstValidIndex = this.events.findIndex((event) => event.timestamp > cutoffTime)

    if (firstValidIndex > 0) {
      this.events = this.events.slice(firstValidIndex)
    } else if (firstValidIndex === -1) {
      // All events are too old
      this.events = []
    }
  }

  /**
   * Get the current list of frames in the buffer (oldest to newest).
   */
  getEvents(): readonly KeyboardFrameEvent[] {
    return this.events
  }

  /**
   * Update the time window without adding new events.
   * This allows pruning old events even when no new events are coming in.
   */
  tick(currentTime: number): void {
    if (currentTime > this.currentTime) {
      this.currentTime = currentTime
      this.prune()
    }
  }

  /**
   * Clear all events from the buffer and reset frame tracking.
   */
  clear(): void {
    this.events = []
    this.lastFrameNumber = -1
    this.currentTime = 0
  }
}
