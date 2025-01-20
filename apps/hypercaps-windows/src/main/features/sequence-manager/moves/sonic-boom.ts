import { moveFactory } from '../move-factory'

const DIFFICULTY_SCALING_FACTOR = 1.5

const SONIC_BOOM_ASCII = `
    ███████╗ ██████╗ ███╗   ██╗██╗ ██████╗    ██████╗  ██████╗  ██████╗ ███╗   ███╗██╗
    ██╔════╝██╔═══██╗████╗  ██║██║██╔════╝    ██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║██║
    ███████╗██║   ██║██╔██╗ ██║██║██║         ██████╔╝██║   ██║██║   ██║██╔████╔██║██║
    ╚════██║██║   ██║██║╚██╗██║██║██║         ██╔══██╗██║   ██║██║   ██║██║╚██╔╝██║╚═╝
    ███████║╚██████╔╝██║ ╚████║██║╚██████╗    ██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║██╗
    ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝ ╚═════╝    ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝
                                     ⚡ ➡️➡️➡️➡️➡️ 💥
`

// Create three versions of Sonic Boom with different strengths
export const lightSonicBoom = moveFactory({
  name: 'Light Sonic Boom',
  steps: [
    {
      type: 'hold',
      keys: ['Left'],
      minHoldMs: 500,
      maxHoldMs: 3000 * DIFFICULTY_SCALING_FACTOR,
      completeOnReleaseAfterMinHold: true
    },
    { type: 'press', keys: ['Right', 'I'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 2,
  strength: 1,
  onComplete: () => console.log('\x1b[36m%s\x1b[0m', SONIC_BOOM_ASCII + '\nLight Sonic Boom!'),
  onFail: () => console.log('Light Sonic Boom failed')
})

export const mediumSonicBoom = moveFactory({
  name: 'Medium Sonic Boom',
  steps: [
    {
      type: 'hold',
      keys: ['Left'],
      minHoldMs: 500,
      maxHoldMs: 3000 * DIFFICULTY_SCALING_FACTOR,
      completeOnReleaseAfterMinHold: true
    },
    { type: 'press', keys: ['Right', 'O'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 2,
  strength: 2,
  onComplete: () => console.log('\x1b[35m%s\x1b[0m', SONIC_BOOM_ASCII + '\nMedium Sonic Boom!!'),
  onFail: () => console.log('Medium Sonic Boom failed')
})

export const heavySonicBoom = moveFactory({
  name: 'Heavy Sonic Boom',
  steps: [
    {
      type: 'hold',
      keys: ['Left'],
      minHoldMs: 500,
      maxHoldMs: 3000 * DIFFICULTY_SCALING_FACTOR,
      completeOnReleaseAfterMinHold: true
    },
    { type: 'press', keys: ['Right', 'P'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 2,
  strength: 3,
  onComplete: () => console.log('\x1b[31m%s\x1b[0m', SONIC_BOOM_ASCII + '\nHEAVY SONIC BOOM!!!'),
  onFail: () => console.log('Heavy Sonic Boom failed')
})
