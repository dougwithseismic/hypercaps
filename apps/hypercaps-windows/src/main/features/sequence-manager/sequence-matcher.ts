import { EventEmitter } from 'events'
import type { InputSequence, KeyboardFrame, Step } from './types'
import { SequenceStateTracker } from './sequence-state-tracker'

export class SequenceMatcher extends EventEmitter {
  private tracker: SequenceStateTracker
  private debugEnabled = false

  constructor() {
    super()
    this.tracker = new SequenceStateTracker()
    this.handleFrame = this.handleFrame.bind(this)
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.tracker.on('sequence:complete', (event) => {
      this.emit('sequence:complete', event)
    })
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled
    this.tracker.setDebug(enabled)
  }

  setFrameRate(rate: number): void {
    this.tracker.setFrameRate(rate)
  }

  get sequences(): Map<string, InputSequence> {
    return this.tracker.registeredSequences
  }

  addSequence(sequence: InputSequence): void {
    this.tracker.addSequence(sequence)
  }

  removeSequence(id: string): void {
    this.tracker.removeSequence(id)
  }

  removeAllSequences(): void {
    this.tracker.removeAllSequences()
  }

  handleFrame(frame: KeyboardFrame): void {
    this.tracker.handleFrame(frame)
  }

  dispose(): void {
    this.tracker.dispose()
    this.removeAllListeners()
  }
}
