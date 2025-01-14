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
  private readonly SIMULTANEOUS_WINDOW = 50; // Window for bundling simultaneous keys

  constructor(maxSize: number, maxAge: number) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  addEvent(event: KeyEvent): void {
    // Try to bundle with recent events if they're close in time
    const recentEvents = this.events.filter(
      (e) => Math.abs(e.timestamp - event.timestamp) <= this.SIMULTANEOUS_WINDOW
    );

    // If we found recent events, adjust this event's timestamp to match
    if (recentEvents.length > 0) {
      event = { ...event, timestamp: recentEvents[0].timestamp };
    }

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
        // Remove matched events to prevent double-matching
        this.events = this.events.filter((e) => !match.events.includes(e));
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

    // Group events by timestamp to handle simultaneous presses
    const eventGroups = this.groupEventsByTimestamp(events);

    // Check if we have enough event groups
    if (eventGroups.length < pattern.sequence.length) {
      return null;
    }

    // Try to match the pattern at each possible starting point
    for (let i = 0; i <= eventGroups.length - pattern.sequence.length; i++) {
      const match = this.tryMatchAtIndex(i, pattern, eventGroups, currentTime);
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

  private groupEventsByTimestamp(events: KeyEvent[]): KeyEvent[][] {
    const groups: Map<number, KeyEvent[]> = new Map();

    for (const event of events) {
      const existing = Array.from(groups.entries()).find(
        ([timestamp]) =>
          Math.abs(timestamp - event.timestamp) <= this.SIMULTANEOUS_WINDOW
      );

      if (existing) {
        existing[1].push(event);
      } else {
        groups.set(event.timestamp, [event]);
      }
    }

    return Array.from(groups.values());
  }

  private tryMatchAtIndex(
    startIndex: number,
    pattern: CommandPattern,
    eventGroups: KeyEvent[][],
    currentTime: number
  ): { events: KeyEvent[]; startTime: number; endTime: number } | null {
    const sequence = pattern.sequence;
    const matchedEvents: KeyEvent[] = [];
    let lastMatchTime = eventGroups[startIndex][0].timestamp;
    let currentIndex = startIndex;

    for (const step of sequence) {
      // Find all events in this group that match this step's keys
      const stepEvents = this.findStepEvents(
        currentIndex,
        step,
        eventGroups,
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
    eventGroups: KeyEvent[][],
    lastMatchTime: number
  ): { events: KeyEvent[]; endTime: number; nextIndex: number } | null {
    const requiredKeys = new Set(step.keys);
    const matchedEvents: KeyEvent[] = [];
    const currentGroup = eventGroups[startIndex];

    // For simultaneous keys, all required keys must be in the current group
    for (const event of currentGroup) {
      if (requiredKeys.has(event.key)) {
        matchedEvents.push(event);
        requiredKeys.delete(event.key);
      }
    }

    // If we didn't find all required keys in this group, it's not a match
    if (requiredKeys.size > 0) {
      return null;
    }

    return {
      events: matchedEvents,
      endTime: currentGroup[currentGroup.length - 1].timestamp,
      nextIndex: startIndex + 1,
    };
  }
}
