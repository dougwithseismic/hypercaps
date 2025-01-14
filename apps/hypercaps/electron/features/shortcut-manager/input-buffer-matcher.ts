import {
  KeyEvent,
  Command,
  CommandMatch,
  CommandPattern,
} from "./types/input-buffer";

export class InputBufferMatcher {
  private events: KeyEvent[] = [];
  private maxSize: number;
  private maxAge: number;

  constructor(maxSize: number, maxAge: number) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  addEvent(event: KeyEvent): void {
    this.events.push(event);
    this.cleanOldEvents(event.timestamp);

    // Keep buffer size under limit
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
  }

  private cleanOldEvents(currentTime: number): void {
    this.events = this.events.filter((event) => {
      return currentTime - event.timestamp <= this.maxAge;
    });
  }

  findMatches(commands: Command[], currentTime: number): CommandMatch[] {
    this.cleanOldEvents(currentTime);
    const matches: CommandMatch[] = [];

    for (const command of commands) {
      const match = this.matchCommand(command, currentTime);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  private matchCommand(
    command: Command,
    currentTime: number
  ): CommandMatch | null {
    const pattern = command.pattern;
    const events = this.events;

    // Check if we have enough events
    if (events.length < pattern.sequence.length) {
      return null;
    }

    // Try to match the pattern at each possible starting point
    for (let i = 0; i <= events.length - pattern.sequence.length; i++) {
      const match = this.tryMatchAtIndex(i, pattern, events, currentTime);
      if (match) {
        return {
          command,
          events: match.events,
          startTime: match.startTime,
          endTime: match.endTime,
        };
      }
    }

    return null;
  }

  private tryMatchAtIndex(
    startIndex: number,
    pattern: CommandPattern,
    events: KeyEvent[],
    currentTime: number
  ): { events: KeyEvent[]; startTime: number; endTime: number } | null {
    const sequence = pattern.sequence;
    const matchedEvents: KeyEvent[] = [];
    let lastMatchTime = events[startIndex].timestamp;
    let currentIndex = startIndex;

    for (const step of sequence) {
      // Find all events that match this step's keys
      const stepEvents = this.findStepEvents(
        currentIndex,
        step,
        events,
        lastMatchTime
      );

      if (!stepEvents) {
        return null;
      }

      matchedEvents.push(...stepEvents.events);
      lastMatchTime = stepEvents.endTime;
      currentIndex = stepEvents.nextIndex;
    }

    // Check total time window
    const startTime = matchedEvents[0].timestamp;
    const endTime = matchedEvents[matchedEvents.length - 1].timestamp;

    if (endTime - startTime > pattern.window) {
      return null;
    }

    return {
      events: matchedEvents,
      startTime,
      endTime,
    };
  }

  private findStepEvents(
    startIndex: number,
    step: { keys: string[]; window: number },
    events: KeyEvent[],
    lastMatchTime: number
  ): { events: KeyEvent[]; endTime: number; nextIndex: number } | null {
    const requiredKeys = new Set(step.keys);
    const matchedEvents: KeyEvent[] = [];
    let currentIndex = startIndex;

    // Try to find all required keys within the time window
    while (requiredKeys.size > 0 && currentIndex < events.length) {
      const event = events[currentIndex];

      // Check if this event is within the time window
      if (event.timestamp - lastMatchTime > step.window) {
        break;
      }

      // If this is a key we're looking for, add it to matched events
      if (requiredKeys.has(event.key)) {
        matchedEvents.push(event);
        requiredKeys.delete(event.key);
      }

      currentIndex++;
    }

    // If we didn't find all required keys, this is not a match
    if (requiredKeys.size > 0) {
      return null;
    }

    return {
      events: matchedEvents,
      endTime: matchedEvents[matchedEvents.length - 1].timestamp,
      nextIndex: currentIndex,
    };
  }
}
