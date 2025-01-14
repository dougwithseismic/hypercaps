export interface KeyBuffer {
  key: string;
  startTime: number;
  lastTapTime: number;
  tapCount: number;
  requiredTaps: number;
  tapWindow: number;
  bufferWindow: number;
  lastInterference?: number;
}
