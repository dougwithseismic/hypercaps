import { moveFactory } from '../move-factory'

// https://andrea-jens.medium.com/i-wanna-make-a-fighting-game-a-practical-guide-for-beginners-part-6-311c51ab21c4
const DIFFICULTY_SCALING_FACTOR = 1.5

const DRAGON_PUNCH_ASCII = `
    ███████╗██╗  ██╗ ██████╗ ██████╗ ██╗   ██╗██╗   ██╗██╗  ██╗███████╗███╗   ██╗██╗
    ██╔════╝██║  ██║██╔═══██╗██╔══██╗╚██╗ ██╔╝██║   ██║██║ ██╔╝██╔════╝████╗  ██║██║
    ███████╗███████║██║   ██║██████╔╝ ╚████╔╝ ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║██║
    ╚════██║██╔══██║██║   ██║██╔══██╗  ╚██╔╝  ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║╚═╝
    ███████║██║  ██║╚██████╔╝██║  ██║   ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║██╗
    ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝
                                     ⚡ ↗️↗️↗️↗️↗️ 💥
`

// Create three versions of Dragon Punch with different strengths
export const lightDragonPunch = moveFactory({
  name: 'Light Dragon Punch',
  steps: [
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Down'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['I'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 3, // Higher priority than Hadouken
  strength: 1,
  onComplete: () => console.log('\x1b[36m%s\x1b[0m', DRAGON_PUNCH_ASCII + '\nLight Dragon Punch!'),
  onFail: () => console.log('Light Dragon Punch failed')
})

export const mediumDragonPunch = moveFactory({
  name: 'Medium Dragon Punch',
  steps: [
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Down'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['O'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 3,
  strength: 2,
  onComplete: () =>
    console.log('\x1b[35m%s\x1b[0m', DRAGON_PUNCH_ASCII + '\nMedium Dragon Punch!!'),
  onFail: () => console.log('Medium Dragon Punch failed')
})

export const heavyDragonPunch = moveFactory({
  name: 'Heavy Dragon Punch',
  steps: [
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Down'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['P'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 3,
  strength: 3,
  onComplete: () =>
    console.log('\x1b[31m%s\x1b[0m', DRAGON_PUNCH_ASCII + '\nHEAVY DRAGON PUNCH!!!'),
  onFail: () => console.log('Heavy Dragon Punch failed')
})
