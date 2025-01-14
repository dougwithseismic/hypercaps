import {
  KeyEvent,
  InputFrame,
  Command,
  CommandMatch,
  KeyState,
} from "./types/input-buffer";

export class InputBufferMatcher {
  private frames: InputFrame[] = [];
  private keyStates: Map<string, KeyState> = new Map();
  private nextFrameId = 0;
  private readonly maxSize: number;
  private readonly maxAge: number;

  constructor(maxSize: number, maxAge: number) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    console.log(
      `[InputBufferMatcher] Initialized with maxSize=${maxSize}, maxAge=${maxAge}`
    );
  }

  public addFrame(frame: InputFrame): void {
    console.log(
      `[InputBufferMatcher] Adding frame ${frame.id} with ${frame.justPressed.size} pressed, ${frame.heldKeys.size} held, ${frame.justReleased.size} released keys`
    );

    // Update key states based on frame data
    for (const key of frame.justPressed) {
      this.keyStates.set(key, {
        key,
        state: "justPressed",
        initialPressTime: frame.timestamp,
        holdDuration: 0,
        lastUpdateTime: frame.timestamp,
      });
    }

    for (const key of frame.heldKeys) {
      const state = this.keyStates.get(key);
      if (state) {
        if (state.state === "justPressed") {
          state.state = "held";
        }
        state.holdDuration = frame.holdDurations.get(key) || 0;
        state.lastUpdateTime = frame.timestamp;
      }
    }

    for (const key of frame.justReleased) {
      const state = this.keyStates.get(key);
      if (state) {
        state.state = "released";
        state.lastUpdateTime = frame.timestamp;
      }
    }

    // Clean up released keys after a frame
    for (const [key, state] of this.keyStates.entries()) {
      if (
        state.state === "released" &&
        frame.timestamp - state.lastUpdateTime > 16
      ) {
        this.keyStates.delete(key);
      }
    }

    this.frames.push(frame);
    this.cleanOldFrames(frame.timestamp);
  }

  private cleanOldFrames(currentTime: number): void {
    // Remove frames older than maxAge or beyond maxSize
    while (
      this.frames.length > 0 &&
      (this.frames.length > this.maxSize ||
        currentTime - this.frames[0].timestamp > this.maxAge)
    ) {
      this.frames.shift();
    }
  }

  public findMatches(commands: Command[]): CommandMatch[] {
    const matches: CommandMatch[] = [];

    for (const command of commands) {
      for (let i = 0; i < this.frames.length; i++) {
        const match = this.tryMatchAtIndex(command, i);
        if (match) {
          matches.push(match);
        }
      }
    }

    return matches;
  }

  private tryMatchAtIndex(
    command: Command,
    startIndex: number
  ): CommandMatch | null {
    const pattern = command.pattern;
    let currentIndex = startIndex;
    const events: KeyEvent[] = [];
    const holdDurations = new Map<string, number>();

    for (const step of pattern.sequence) {
      const frame = this.frames[currentIndex];
      if (!frame) return null;

      switch (step.type) {
        case "press":
          if (!this.matchPressStep(step.keys, frame)) return null;
          break;
        case "hold":
          if (
            !this.matchHoldStep(
              step.keys,
              frame,
              step.holdTime || 0,
              holdDurations
            )
          )
            return null;
          break;
        case "release":
          if (!this.matchReleaseStep(step.keys, frame)) return null;
          break;
        case "combo":
          if (!this.matchComboStep(step.keys, frame)) return null;
          break;
      }

      // Add events from this frame
      events.push(...this.getEventsFromFrame(frame));

      // Move to next frame if not at end
      if (currentIndex < this.frames.length - 1) {
        currentIndex++;
      }
    }

    const startTime = this.frames[startIndex].timestamp;
    const endTime = this.frames[currentIndex].timestamp;

    // Check if pattern completed within window
    if (endTime - startTime > pattern.window) {
      return null;
    }

    return {
      command,
      events,
      startTime,
      endTime,
      holdDurations,
    };
  }

  private matchPressStep(keys: string[], frame: InputFrame): boolean {
    return keys.every((key) => frame.justPressed.has(key));
  }

  private matchHoldStep(
    keys: string[],
    frame: InputFrame,
    requiredHoldTime: number,
    holdDurations: Map<string, number>
  ): boolean {
    // All keys must be either held or just pressed
    if (
      !keys.every(
        (key) => frame.heldKeys.has(key) || frame.justPressed.has(key)
      )
    ) {
      return false;
    }

    // Check hold durations
    for (const key of keys) {
      const duration = frame.holdDurations.get(key) || 0;
      if (duration < requiredHoldTime) {
        return false;
      }
      holdDurations.set(key, duration);
    }

    return true;
  }

  private matchReleaseStep(keys: string[], frame: InputFrame): boolean {
    return keys.every((key) => frame.justReleased.has(key));
  }

  private matchComboStep(keys: string[], frame: InputFrame): boolean {
    // For combos, we just care that all keys are active in this frame
    // They can be either just pressed or held
    return keys.every(
      (key) => frame.justPressed.has(key) || frame.heldKeys.has(key)
    );
  }

  private getEventsFromFrame(frame: InputFrame): KeyEvent[] {
    const events: KeyEvent[] = [];

    // Add press events
    for (const key of frame.justPressed) {
      events.push({ key, type: "press", timestamp: frame.timestamp });
    }

    // Add release events
    for (const key of frame.justReleased) {
      events.push({ key, type: "release", timestamp: frame.timestamp });
    }

    return events;
  }
}
