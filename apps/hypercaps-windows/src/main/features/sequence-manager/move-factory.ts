import type { MoveDefinition, MoveStep } from './types'

/**
 * Convenience function for creating moves with consistent shape.
 * Each move has:
 * - A unique name
 * - An ordered sequence of steps (press, hold, hitConfirm)
 * - Optional callbacks for completion and failure
 */
export const moveFactory = (
  name: string,
  steps: MoveStep[],
  onComplete?: () => void,
  onFail?: () => void
): MoveDefinition => {
  return {
    name,
    steps,
    onComplete,
    onFail
  }
}
