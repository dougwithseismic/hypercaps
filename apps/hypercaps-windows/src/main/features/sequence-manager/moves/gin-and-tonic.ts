import { moveFactory } from '../move-factory'

/**
 * Gin and Tonic
 * =============
 * Input: Hold G, tap T twice
 *
 * Steps:
 * 1. Hold G (min 100ms)
 * 2. Press T while holding G
 * 3. Press T again while still holding G
 */
export const ginAndTonic = moveFactory({
  name: 'Gin and Tonic',
  priority: 2, // Medium priority
  strength: 2, // Medium strength
  steps: [
    {
      type: 'hold',
      keys: ['G'],
      minHoldMs: 100, // Need to hold G for at least 100ms
      maxHoldMs: 3000 // Max 3 second hold
    },
    {
      type: 'press',
      keys: ['T'],
      maxGapMs: 500 // Must press T within 500ms
      // The hold from step 1 must continue during this press
    },
    {
      type: 'press',
      keys: ['T'],
      maxGapMs: 300 // Tighter window for second T press
      // The hold from step 1 must still continue
    }
  ],
  onComplete: () => {
    console.log('🍸 Gin and Tonic activated!')
  },
  onFail: () => {
    console.log('❌ Gin and Tonic failed')
  }
})
