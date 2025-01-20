import type { MoveDefinition, MoveFactoryParams } from './types'

/**
 * Convenience function for creating moves with consistent shape.
 * Uses RORO (Receive Object, Return Object) pattern for better readability and maintainability.
 *
 * Example usage:
 * ```ts
 * const hadouken = moveFactory({
 *   name: 'Hadouken',
 *   steps: [
 *     { type: 'press', keys: ['Down'], maxGapMs: 200 },
 *     { type: 'press', keys: ['Right'], maxGapMs: 200 },
 *     { type: 'press', keys: ['P'], maxGapMs: 250 }
 *   ],
 *   priority: 2,
 *   strength: 1,
 *   onComplete: () => console.log('Hadouken!'),
 * })
 * ```
 */
export const moveFactory = ({
  name,
  steps,
  priority = 1,
  strength = 1,
  onComplete,
  onFail
}: MoveFactoryParams): MoveDefinition => {
  return {
    name,
    steps,
    priority,
    strength,
    onComplete,
    onFail
  }
}
