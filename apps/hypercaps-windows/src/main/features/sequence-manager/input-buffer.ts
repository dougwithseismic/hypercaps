import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import type { FrameInput, KeyInput } from './types'

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

  constructor(private maxWindowMs: number = 2000) {}

  /** Add a new frame to the buffer and prune old ones. */
  public addFrame(event: KeyboardFrameEvent) {
    this.events.push(event)
    this.lastTimestamp = event.timestamp
    this.prune()
  }

  /** If time advanced but no new frames, we can still prune old frames. */
  public tick(now: number) {
    // If we want to prune based on an external clock:
    if (now > this.lastTimestamp) {
      this.lastTimestamp = now
      this.prune()
    }
  }

  private prune() {
    const cutoff = this.lastTimestamp - this.maxWindowMs
    while (this.events.length && this.events[0].timestamp < cutoff) {
      this.events.shift()
    }
  }

  public getEvents(): readonly KeyboardFrameEvent[] {
    return this.events
  }

  public clear() {
    this.events = []
  }
}

/**
 * Utility function that merges the last ~frameDurationMs worth
 * of press/release data into a single FrameInput snapshot.
 *
 * If you want more advanced partial detection (like building "downRight"
 * if 'down' & 'right' were pressed within ~50ms of each other),
 * you can do so here. Or handle diagonals at your own step logic.
 */
export function buildFrameInputFromBuffer(
  buffer: InputBuffer,
  now: number,
  frameDurationMs = 16.67
): FrameInput {
  const frameStart = now - frameDurationMs
  const events = buffer.getEvents()

  // Initialize the result
  const justPressed: Record<KeyInput, number | undefined> = {}
  const justReleased: KeyInput[] = []
  const currentlyHeld: KeyInput[] = []
  const holdDuration: Record<KeyInput, number | undefined> = {}

  // We'll track final key states and press times
  const keyStateMap = new Map<KeyInput, { pressed: boolean; lastPressTime: number }>()

  // 1) Identify which keys were pressed/released *during* this frame
  //    i.e. events that occurred after frameStart
  for (const e of events) {
    if (e.timestamp < frameStart || e.timestamp > now) continue
    const state = e.state
    // justPressed
    for (const k of state.justPressed) {
      justPressed[k] = e.timestamp // store time
    }
    // justReleased
    for (const k of state.justReleased) {
      justReleased.push(k)
    }
  }

  // 2) Reconstruct "currentlyHeld" by scanning the entire buffer from oldest to newest
  //    The last mention of a key (pressed or released) determines if it's held
  const keyPressTime: Record<KeyInput, number> = {}
  for (const e of events) {
    for (const k of e.state.justPressed) {
      keyPressTime[k] = e.timestamp
      keyStateMap.set(k, { pressed: true, lastPressTime: e.timestamp })
    }
    for (const k of e.state.justReleased) {
      // Key is no longer pressed
      keyStateMap.set(k, { pressed: false, lastPressTime: 0 })
    }
  }
  // Now any key that is mapped to { pressed: true } is currently held
  for (const [key, info] of keyStateMap) {
    if (info.pressed) {
      currentlyHeld.push(key)
      // holdDuration = now - info.lastPressTime
      holdDuration[key] = now - info.lastPressTime
    }
  }

  // Return the final frame input
  return {
    justPressed,
    justReleased,
    currentlyHeld,
    holdDuration
  }
}
