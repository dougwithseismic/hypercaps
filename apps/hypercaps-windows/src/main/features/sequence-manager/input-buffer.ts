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
  private lastTimestamp = 0
  private lastFrameNumber = -1

  constructor(private maxWindowMs: number = 2000) {}

  /** Add a new frame to the buffer and prune old ones. */
  public addFrame(event: KeyboardFrameEvent): void {
    // Ensure frames are added in order
    if (event.frameNumber <= this.lastFrameNumber) {
      throw new Error(
        `Frame ${event.frameNumber} added out of order (last was ${this.lastFrameNumber})`
      )
    }
    this.lastFrameNumber = event.frameNumber

    this.prune()
    this.events.push(event)
    this.lastTimestamp = event.timestamp
  }

  /** If time advanced but no new frames, we can still prune old frames. */
  public tick(now: number): void {
    // If we want to prune based on an external clock:
    if (now > this.lastTimestamp) {
      this.lastTimestamp = now
      this.prune()
    }
  }

  private prune(): void {
    const cutoff = this.lastTimestamp - this.maxWindowMs
    while (this.events.length && this.events[0].timestamp < cutoff) {
      this.events.shift()
    }
  }

  public getEvents(): readonly KeyboardFrameEvent[] {
    return this.events
  }

  public clear(): void {
    this.events = []
    this.lastFrameNumber = -1
  }
}
