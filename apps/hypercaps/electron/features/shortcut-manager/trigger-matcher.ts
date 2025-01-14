import { InputBufferMatcher } from "./input-buffer-matcher";
import { Command, CommandMatch, InputFrame } from "./types/input-buffer";
import { TriggerStep, TriggerStepType } from "./types/shortcut";

export class TriggerMatcher {
  private inputBuffer: InputBufferMatcher;
  private lastMatchTime = 0;
  private readonly maxAge: number;

  constructor(maxSize: number, maxAge: number) {
    this.inputBuffer = new InputBufferMatcher(maxSize, maxAge);
    this.maxAge = maxAge;
    console.log(
      `[TriggerMatcher] Initialized with maxSize=${maxSize}, maxAge=${maxAge}`
    );
  }

  public addFrame(frame: InputFrame): void {
    console.log(
      `[TriggerMatcher] Adding frame with ${frame.justPressed.size} pressed, ${frame.heldKeys.size} held, ${frame.justReleased.size} released keys`
    );
    this.inputBuffer.addFrame(frame);
  }

  public findMatches(commands: Command[]): CommandMatch[] {
    return this.inputBuffer.findMatches(commands);
  }

  public isStepMatched(step: TriggerStep, frame: InputFrame): boolean {
    console.log(`[TriggerMatcher] Checking step match:`, {
      type: step.type,
      keys: step.keys,
      holdTime: step.holdTime,
      window: step.window,
    });

    switch (step.type) {
      case "hold":
        // For hold steps, check if all keys are held and meet the hold duration
        if (!step.holdTime) {
          console.log(`[TriggerMatcher] Hold step missing holdTime`);
          return false;
        }

        // All keys must be either held or just pressed
        if (
          !step.keys.every(
            (key) => frame.heldKeys.has(key) || frame.justPressed.has(key)
          )
        ) {
          console.log(`[TriggerMatcher] Not all keys are held/pressed`);
          return false;
        }

        // Check hold durations for each key
        for (const key of step.keys) {
          const duration = frame.holdDurations.get(key) || 0;
          console.log(
            `[TriggerMatcher] Key ${key} hold duration: ${duration}ms, required: ${step.holdTime}ms`
          );
          if (duration < step.holdTime) {
            return false;
          }
        }
        return true;

      case "combo":
        // For combo steps, we just care that all keys are active in this frame
        // They can be either just pressed or held
        const allKeysActive = step.keys.every(
          (key) => frame.justPressed.has(key) || frame.heldKeys.has(key)
        );

        console.log(`[TriggerMatcher] Combo step check:`, {
          allKeysActive,
          justPressed: Array.from(frame.justPressed),
          heldKeys: Array.from(frame.heldKeys),
        });

        return allKeysActive;

      case "single":
        // For single steps, at least one key must be just pressed
        const isPressed = step.keys.some((key) => frame.justPressed.has(key));
        console.log(
          `[TriggerMatcher] Single step check: isPressed=${isPressed}`
        );
        return isPressed;

      default:
        console.log(`[TriggerMatcher] Unknown step type: ${step.type}`);
        return false;
    }
  }

  public reset(): void {
    console.log("[TriggerMatcher] Resetting state");
    this.lastMatchTime = 0;
  }
}
