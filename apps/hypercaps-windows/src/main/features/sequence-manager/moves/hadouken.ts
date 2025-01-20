import { moveFactory } from '../move-factory'

const DIFFICULTY_SCALING_FACTOR = 1

const HADOUKEN_ASCII = `
    ██╗  ██╗ █████╗ ██████╗  ██████╗ ██╗   ██╗██╗  ██╗███████╗███╗   ██╗██╗
    ██║  ██║██╔══██╗██╔══██╗██╔═══██╗██║   ██║██║ ██╔╝██╔════╝████╗  ██║██║
    ███████║███████║██║  ██║██║   ██║██║   ██║█████╔╝ █████╗  ██╔██╗ ██║██║
    ██╔══██║██╔══██║██║  ██║██║   ██║██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║╚═╝
    ██║  ██║██║  ██║██████╔╝╚██████╔╝╚██████╔╝██║  ██╗███████╗██║ ╚████║██╗
    ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝
                                  🔥 ➜➜➜➜➜ 💥
`

// Create three versions of Hadouken with different strengths
export const lightHadouken = moveFactory({
  name: 'Light Hadouken',
  steps: [
    { type: 'press', keys: ['Down'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['I'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 2,
  strength: 1,
  onComplete: () => console.log('\x1b[36m%s\x1b[0m', HADOUKEN_ASCII + '\nLight Hadouken!'),
  onFail: () => console.log('Light Hadouken failed')
})

export const mediumHadouken = moveFactory({
  name: 'Medium Hadouken',
  steps: [
    { type: 'press', keys: ['Down'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['O'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 2,
  strength: 2,
  onComplete: () => console.log('\x1b[35m%s\x1b[0m', HADOUKEN_ASCII + '\nMedium Hadouken!!'),
  onFail: () => console.log('Medium Hadouken failed')
})

export const heavyHadouken = moveFactory({
  name: 'Heavy Hadouken',
  steps: [
    { type: 'press', keys: ['Down'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['Right'], maxGapMs: 200 * DIFFICULTY_SCALING_FACTOR },
    { type: 'press', keys: ['P'], maxGapMs: 250 * DIFFICULTY_SCALING_FACTOR }
  ],
  priority: 2,
  strength: 3,
  onComplete: () => console.log('\x1b[31m%s\x1b[0m', HADOUKEN_ASCII + '\nHEAVY HADOUKEN!!!'),
  onFail: () => console.log('Heavy Hadouken failed')
})
