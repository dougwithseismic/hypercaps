import { KeyboardFrame } from './types'

export interface RollingWindowOptions {
  /** Maximum number of frames to keep in buffer */
  maxFrames: number
  /** Maximum age of frames in milliseconds */
  maxAgeMs: number
}

export class RollingWindow {
  private frames: KeyboardFrame[] = []
  private readonly maxSize: number
  private readonly maxAge: number

  constructor({ maxFrames = 32, maxAgeMs = 3000 }: RollingWindowOptions) {
    this.maxSize = maxFrames
    this.maxAge = maxAgeMs
    console.log(`[RollingWindow] Initialized with maxFrames=${maxFrames}, maxAgeMs=${maxAgeMs}`)
  }

  public addFrame(frame: KeyboardFrame): void {
    // Clean old frames first
    this.cleanOldFrames({ frame })
    // Then add new frame
    this.frames.push(frame)
  }
  private cleanOldFrames({ frame }: { frame: KeyboardFrame }): void {
    const currentTime = frame.timestamp
    if (this.frames.length === 0) return

    // Remove frames that exceed either maxSize or maxAge in one pass
    const cutoffIndex = this.frames.findIndex(
      (f) =>
        this.frames.length - this.frames.indexOf(f) <= this.maxSize &&
        currentTime - f.timestamp <= this.maxAge
    )

    if (cutoffIndex > 0) {
      this.frames = this.frames.slice(cutoffIndex)
    }
  }

  public getFrames(): KeyboardFrame[] {
    return this.frames
  }

  public reset(): void {
    this.frames = []
  }
}
