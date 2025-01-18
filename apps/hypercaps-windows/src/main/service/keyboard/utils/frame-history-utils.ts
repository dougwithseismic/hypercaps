import { KeyboardFrameEvent } from '../types'

interface FrameHistoryConfig {
  maxSize: number
  retentionFrames: number
}

export const cleanupFrameHistory = (
  frameHistory: KeyboardFrameEvent[],
  config: FrameHistoryConfig,
  currentFrameNumber?: number
): KeyboardFrameEvent[] => {
  const { maxSize, retentionFrames } = config
  const currentFrame =
    currentFrameNumber ?? frameHistory[frameHistory.length - 1]?.state.frameNumber ?? 0

  let cleanedHistory = frameHistory.filter(
    (frame) => currentFrame - frame.state.frameNumber < retentionFrames
  )

  if (cleanedHistory.length > maxSize) {
    cleanedHistory = cleanedHistory.slice(-maxSize)
  }

  return cleanedHistory
}
