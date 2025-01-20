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
    // Log frame timing for debugging
    const timeSinceLastFrame =
      this.lastFrameNumber >= 0
        ? event.timestamp - this.events[this.events.length - 1].timestamp
        : 0

    console.debug(
      `Frame ${event.frameNumber}:`,
      `Δt=${timeSinceLastFrame}ms,`,
      `Press:[${event.state.justPressed.join(',')}]`,
      `Release:[${event.state.justReleased.join(',')}]`,
      `Held:[${event.state.held.join(',')}]`,
      `Durations:`,
      event.state.holdDurations
    )

    // Ensure frames are added in order with some leniency
    if (event.frameNumber < this.lastFrameNumber - 1) {
      console.warn(
        `Frame ${event.frameNumber} added out of order (last was ${this.lastFrameNumber})`
      )
      return // Skip out-of-order frames
    }

    this.prune()
    this.events.push(event)
    this.lastFrameNumber = event.frameNumber
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

  /** Get recent events within a specific time window */
  public getRecentEvents(windowMs: number): readonly KeyboardFrameEvent[] {
    const cutoff = this.lastTimestamp - windowMs
    return this.events.filter((e) => e.timestamp >= cutoff)
  }

  public clear(): void {
    this.events = []
    this.lastFrameNumber = -1
  }
}
