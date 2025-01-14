import {
  TriggerState,
  TriggerStep,
  ShortcutTrigger,
  BufferConfig,
} from "./types/shortcut";
import { KeyBuffer } from "./types/key-buffer";

export class TriggerMatcher {
  private state: TriggerState;
  private trigger: ShortcutTrigger;

  constructor(trigger: ShortcutTrigger) {
    this.trigger = trigger;
    this.resetState(Date.now());
  }

  private resetState(timestamp: number): void {
    this.state = {
      currentStep: 0,
      stepStartTime: timestamp,
      sequenceStartTime: timestamp,
      pressedKeys: new Set<string>(),
      completedSteps: new Array(this.trigger.steps.length).fill(false),
    };
  }

  private isStepTimedOut(step: TriggerStep, timestamp: number): boolean {
    if (!step.timeWindow) return false;
    return timestamp - this.state.stepStartTime > step.timeWindow;
  }

  private isSequenceTimedOut(timestamp: number): boolean {
    if (!this.trigger.totalTimeWindow) return false;
    return (
      timestamp - this.state.sequenceStartTime > this.trigger.totalTimeWindow
    );
  }

  private isComboMatched(step: TriggerStep): boolean {
    return step.keys.every((key) => this.state.pressedKeys.has(key));
  }

  private isSingleMatched(
    step: TriggerStep,
    buffers: Map<string, KeyBuffer>
  ): boolean {
    // For single key steps, check if any of the expected keys has a completed buffer
    return step.keys.some((key) => {
      const buffer = buffers.get(key);
      const bufferConfig = this.getStepBuffer(step);
      return buffer && buffer.tapCount >= (bufferConfig.tapCount || 1);
    });
  }

  public getStepBuffer(step: TriggerStep): BufferConfig {
    return {
      window: step.buffer?.window ?? this.trigger.defaultBuffer?.window ?? 200,
      tapCount:
        step.buffer?.tapCount ?? this.trigger.defaultBuffer?.tapCount ?? 1,
      tapWindow:
        step.buffer?.tapWindow ?? this.trigger.defaultBuffer?.tapWindow ?? 100,
      holdTime: step.buffer?.holdTime ?? this.trigger.defaultBuffer?.holdTime,
    };
  }

  private isStepMatched(
    step: TriggerStep,
    buffers: Map<string, KeyBuffer>
  ): boolean {
    if (step.type === "combo") {
      return this.isComboMatched(step);
    } else {
      return this.isSingleMatched(step, buffers);
    }
  }

  public updateState(
    pressedKeys: Set<string>,
    buffers: Map<string, KeyBuffer>,
    timestamp: number
  ): boolean {
    // Check for timeouts
    if (this.isSequenceTimedOut(timestamp)) {
      this.resetState(timestamp);
      return false;
    }

    const currentStep = this.trigger.steps[this.state.currentStep];
    if (this.isStepTimedOut(currentStep, timestamp)) {
      this.resetState(timestamp);
      return false;
    }

    // Update pressed keys
    this.state.pressedKeys = pressedKeys;

    // Check if current step is matched
    if (this.isStepMatched(currentStep, buffers)) {
      this.state.completedSteps[this.state.currentStep] = true;

      // Move to next step
      if (this.state.currentStep < this.trigger.steps.length - 1) {
        this.state.currentStep++;
        this.state.stepStartTime = timestamp;
        return false;
      }

      // All steps completed
      const completed = this.state.completedSteps.every((step) => step);
      if (completed) {
        this.resetState(timestamp);
        return true;
      }
    }

    return false;
  }

  public getCurrentProgress(): {
    currentStep: number;
    totalSteps: number;
    completedSteps: boolean[];
  } {
    return {
      currentStep: this.state.currentStep,
      totalSteps: this.trigger.steps.length,
      completedSteps: [...this.state.completedSteps],
    };
  }

  public getRequiredKeys(): Set<string> {
    const keys = new Set<string>();
    this.trigger.steps.forEach((step) => {
      step.keys.forEach((key) => keys.add(key));
    });
    return keys;
  }

  public getStepForKey(key: string): TriggerStep | null {
    return this.trigger.steps.find((step) => step.keys.includes(key)) || null;
  }
}
