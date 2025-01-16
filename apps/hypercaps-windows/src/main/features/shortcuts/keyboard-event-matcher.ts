import {
  KeyEvent,
  KeyboardFrame,
  KeyboardState,
  Command,
  CommandMatch,
  TriggerStep,
} from './types';

export class KeyboardEventMatcher {
  private frames: KeyboardFrame[] = [];
  private keyStates: Map<string, KeyboardState> = new Map();
  private nextFrameId = 0;
  private readonly maxSize: number;
  private readonly maxAge: number;

  constructor(maxSize: number, maxAge: number) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    console.log(
      `[KeyboardEventMatcher] Initialized with maxSize=${maxSize}, maxAge=${maxAge}`
    );
  }

  public addFrame(frame: KeyboardFrame): void {
    // Update key states based on frame data
    for (const key of frame.justPressed) {
      this.keyStates.set(key, {
        key,
        state: 'justPressed',
        initialPressTime: frame.timestamp,
        holdDuration: 0,
        lastUpdateTime: frame.timestamp,
      });
    }

    for (const key of frame.heldKeys) {
      const state = this.keyStates.get(key);
      if (state) {
        if (state.state === 'justPressed') {
          state.state = 'held';
        }
        state.holdDuration = frame.holdDurations.get(key) || 0;
        state.lastUpdateTime = frame.timestamp;
      }
    }

    for (const key of frame.justReleased) {
      const state = this.keyStates.get(key);
      if (state) {
        state.state = 'released';
        state.lastUpdateTime = frame.timestamp;
      }
    }

    // Clean up released keys after a frame
    for (const [key, state] of this.keyStates.entries()) {
      if (
        state.state === 'released' &&
        frame.timestamp - state.lastUpdateTime > 16
      ) {
        this.keyStates.delete(key);
      }
    }

    this.frames.push(frame);
    this.cleanOldFrames(frame.timestamp);
  }

  private cleanOldFrames(currentTime: number): void {
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

    for (const step of pattern.steps) {
      const frame = this.frames[currentIndex];
      if (!frame) return null;

      if (!this.isStepMatched(step, frame, holdDurations)) {
        return null;
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

  private isStepMatched(
    step: TriggerStep,
    frame: KeyboardFrame,
    holdDurations: Map<string, number>
  ): boolean {
    switch (step.type) {
      case 'hold':
        if (!step.conditions?.holdTime) return false;

        // All keys must be either held or just pressed
        if (
          !step.keys.every(
            (key: string) =>
              frame.heldKeys.has(key) || frame.justPressed.has(key)
          )
        ) {
          return false;
        }

        // Check hold durations
        for (const key of step.keys) {
          const duration = frame.holdDurations.get(key) || 0;
          if (duration < step.conditions.holdTime) {
            return false;
          }
          holdDurations.set(key, duration);
        }
        return true;

      case 'combo':
        const allKeysActive = step.keys.every(
          (key: string) => frame.justPressed.has(key) || frame.heldKeys.has(key)
        );
        const isStrict = step.conditions?.strict ?? false;

        if (isStrict) {
          return step.keys.every((key: string) => frame.justPressed.has(key));
        }
        return allKeysActive;

      case 'press':
        return step.keys.some((key: string) => frame.justPressed.has(key));

      case 'release':
        return step.keys.every((key: string) => frame.justReleased.has(key));

      default:
        return false;
    }
  }

  private getEventsFromFrame(frame: KeyboardFrame): KeyEvent[] {
    const events: KeyEvent[] = [];

    for (const key of frame.justPressed) {
      events.push({ key, type: 'press', timestamp: frame.timestamp });
    }

    for (const key of frame.justReleased) {
      events.push({
        key,
        type: 'release',
        timestamp: frame.timestamp,
        duration: frame.holdDurations.get(key),
      });
    }

    return events;
  }

  public reset(): void {
    this.frames = [];
    this.keyStates.clear();
  }

  public clearFramesUpTo(timestamp: number): void {
    const index = this.frames.findIndex((frame) => frame.timestamp > timestamp);
    if (index !== -1) {
      this.frames = this.frames.slice(index);
      // Clean up key states for keys that were last seen in cleared frames
      for (const [key, state] of this.keyStates.entries()) {
        if (state.lastUpdateTime <= timestamp) {
          this.keyStates.delete(key);
        }
      }
    } else {
      this.reset();
    }
  }
}
