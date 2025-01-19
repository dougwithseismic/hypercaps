import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SequenceMatcher } from './sequence-matcher'
import type { InputSequence, KeyboardFrame } from './types'

const singleKeySequence: InputSequence = {
  id: 'single-key-test',
  type: 'SEQUENCE',
  timeoutMs: 1000,
  steps: [
    {
      type: 'STATE',
      held: [84],
      toleranceMs: 200,
      duration: {
        minMs: 0,
        maxMs: 200
      }
    }
  ]
}

const hadoukenSequence: InputSequence = {
  id: 'hadouken',
  type: 'SEQUENCE',
  timeoutMs: 1000,
  steps: [
    {
      type: 'STATE',
      held: [40], // Down
      toleranceMs: 100,
      duration: {
        minMs: 16,
        maxMs: 300
      }
    },
    {
      type: 'STATE',
      held: [40, 39], // Down + Right (diagonal)
      toleranceMs: 100,
      duration: {
        minMs: 16,
        maxMs: 300
      }
    },
    {
      type: 'STATE',
      held: [39], // Right
      toleranceMs: 100,
      duration: {
        minMs: 16,
        maxMs: 300
      }
    },
    {
      type: 'STATE',
      held: [80], // P (punch)
      toleranceMs: 100,
      duration: {
        minMs: 16,
        maxMs: 300
      }
    }
  ]
}

const sonicBoom: InputSequence = {
  id: 'sonic-boom',
  type: 'SEQUENCE',
  timeoutMs: 2000,
  steps: [
    {
      type: 'STATE',
      held: [37], // Left/Back charge
      toleranceMs: 100,
      duration: {
        minMs: 1000, // Charge time
        maxMs: 5000
      }
    },

    {
      type: 'STATE',
      held: [39, 80], // Forward + Punch
      toleranceMs: 100,
      duration: {
        triggerMs: 16 // Must be precise
      }
    }
  ]
}

const flashKick: InputSequence = {
  id: 'flash-kick',
  type: 'SEQUENCE',
  timeoutMs: 2000,
  steps: [
    {
      type: 'STATE',
      held: [40], // Down charge
      toleranceMs: 100,
      duration: {
        minMs: 1000, // Charge time
        maxMs: 5000
      }
    },

    {
      type: 'STATE',
      held: [38, 75], // Up + Kick
      toleranceMs: 100,
      duration: {
        triggerMs: 16 // Must be precise
      }
    }
  ]
}

const dragonPunchSequence: InputSequence = {
  id: 'dragon-punch',
  type: 'SEQUENCE',
  timeoutMs: 800, // Slightly stricter timing than hadouken
  steps: [
    {
      type: 'STATE',
      held: [39], // Right
      toleranceMs: 100,
      duration: {
        minMs: 16,
        maxMs: 200
      }
    },
    {
      type: 'STATE',
      released: [39], // Release Right
      toleranceMs: 100,
      duration: {
        minMs: 0,
        maxMs: 100
      }
    },
    {
      type: 'STATE',
      held: [40], // Down
      toleranceMs: 100,
      duration: {
        minMs: 16,
        maxMs: 200
      }
    },
    {
      type: 'STATE',
      held: [40, 39], // Down + Right
      toleranceMs: 100,
      duration: {
        minMs: 16,
        maxMs: 200
      }
    }
  ]
}

describe('SequenceMatcher', () => {
  let matcher: SequenceMatcher
  let now: number

  beforeEach(() => {
    vi.useFakeTimers()
    now = Date.now()
    matcher = new SequenceMatcher()
    matcher.setDebug(true)
    matcher.removeAllSequences()
  })

  const createFrame = (
    justPressed: number[] = [],
    held: number[] = [],
    justReleased: number[] = [],
    timestamp = now,
    frameNumber = 0
  ): KeyboardFrame => ({
    timestamp,
    frameNumber,
    justPressed: new Set(justPressed),
    heldKeys: new Set(held),
    justReleased: new Set(justReleased)
  })

  describe('Basic Functionality', () => {
    beforeEach(() => {
      matcher.setDebug(true)
      matcher.removeAllSequences()
    })

    it('should add and remove sequences', () => {
      matcher.addSequence(singleKeySequence)
      expect(matcher.sequences.size).toBe(1)

      matcher.removeSequence('single-key-test')
      expect(matcher.sequences.size).toBe(0)
    })

    it('should detect a single key press', () => {
      matcher.addSequence(singleKeySequence)

      let detected = false
      matcher.on('sequence:complete', () => {
        detected = true
      })

      matcher.handleFrame(createFrame([84], [84], [], now, 0))
      vi.advanceTimersByTime(100)
      matcher.handleFrame(createFrame([], [84], [], now + 100, 1))
      vi.advanceTimersByTime(100)
      matcher.handleFrame(createFrame([], [], [84], now + 200, 2))

      expect(detected).toBe(true)
    })

    it('should detect a qcf movement', () => {
      const up = 38
      const down = 40
      const left = 37
      const right = 39

      matcher.addSequence({
        id: 'qcf',
        type: 'SEQUENCE',
        steps: [
          {
            type: 'STATE',
            pressed: [down], // Down
            held: [down], // Right
            toleranceMs: 100,
            duration: {
              minMs: 16,
              maxMs: 200
            }
          },
          {
            type: 'STATE',
            held: [right, down], // Right
            toleranceMs: 100,
            duration: {
              minMs: 16
            }
          },
          {
            type: 'STATE',
            held: [right], // right
            toleranceMs: 100,
            duration: { minMs: 16 }
          }
        ]
      })

      const detected: string[] = []
      matcher.on('sequence:complete', (event) => {
        detected.push(event.id)
      })

      matcher.handleFrame(createFrame([down], [down], [], now, 0)) // right
      vi.advanceTimersByTime(100)
      matcher.handleFrame(createFrame([right], [down, right], [], now + 100, 1)) // right
      vi.advanceTimersByTime(100)
      matcher.handleFrame(createFrame([], [right], [down], now + 200, 2)) // right + down

      expect(detected).toEqual(['qcf'])
    })

    it('should handle overlapping sequences', () => {
      const sequence1: InputSequence = {
        id: 'sequence1',
        type: 'STATE',
        held: [32], // Space
        toleranceMs: 100,
        duration: {
          minMs: 0,
          maxMs: 1000,
          triggerMs: 500
        }
      }

      const sequence2: InputSequence = {
        id: 'sequence2',
        type: 'STATE',
        held: [32], // Space
        toleranceMs: 100,
        duration: {
          minMs: 0,
          maxMs: 1000,
          triggerMs: 1000
        }
      }

      matcher.addSequence(sequence1)
      matcher.addSequence(sequence2)

      const detected: string[] = []
      matcher.on('sequence:complete', (event) => {
        detected.push(event.id)
      })

      // Press Space
      matcher.handleFrame(createFrame([32], [32], [], now, 0))
      vi.advanceTimersByTime(500)

      // Hold Space
      matcher.handleFrame(createFrame([], [32], [], now + 500, 1))
      vi.advanceTimersByTime(500)

      // Release Space
      matcher.handleFrame(createFrame([], [], [32], now + 1000, 2))

      expect(detected).toEqual(['sequence1', 'sequence2'])
    })
  })

  describe('Fighting Game Moves', () => {
    beforeEach(() => {
      matcher.setDebug(true)
      matcher.removeAllSequences()
    })

    it('should detect a hadouken motion', () => {
      matcher.addSequence(hadoukenSequence)

      let detected = false
      matcher.on('sequence:complete', () => {
        detected = true
      })

      // Press Down
      matcher.handleFrame(createFrame([40], [40], [], now, 0))
      vi.advanceTimersByTime(100)

      // Down to Down-Right
      matcher.handleFrame(createFrame([39], [40, 39], [], now + 100, 1))
      vi.advanceTimersByTime(100)

      // Down-Right to Right
      matcher.handleFrame(createFrame([], [39], [], now + 200, 2))
      vi.advanceTimersByTime(50)

      // Press Punch while holding Right
      matcher.handleFrame(createFrame([80], [39, 80], [], now + 250, 3))
      vi.advanceTimersByTime(100)

      expect(detected).toBe(true)
    })

    it('should prioritize dragon punch over hadouken when inputs overlap', () => {
      matcher.addSequence(hadoukenSequence)
      matcher.addSequence(dragonPunchSequence)

      const detected: string[] = []
      matcher.on('sequence:complete', (event) => {
        detected.push(event.id)
      })

      // Press Right
      matcher.handleFrame(createFrame([39], [39], [], now, 0))
      vi.advanceTimersByTime(50)

      // Release Right
      matcher.handleFrame(createFrame([], [], [39], now + 50, 1))
      vi.advanceTimersByTime(50)

      // Press Down
      matcher.handleFrame(createFrame([40], [40], [], now + 100, 2))
      vi.advanceTimersByTime(50)

      // Press Down+Right
      matcher.handleFrame(createFrame([39], [40, 39], [], now + 150, 3))
      vi.advanceTimersByTime(100)

      expect(detected).toEqual(['dragon-punch'])
    })

    describe('Guile Moves', () => {
      it('should detect Sonic Boom (charge back, forward + punch)', () => {
        const sonicBoom: InputSequence = {
          id: 'sonic-boom',
          type: 'SEQUENCE',
          timeoutMs: 2000,
          steps: [
            {
              type: 'STATE',
              held: [37], // Left/Back charge
              toleranceMs: 100,
              duration: {
                minMs: 1000, // Charge time
                maxMs: 5000
              }
            },

            {
              type: 'STATE',
              held: [39, 80], // Forward + Punch
              toleranceMs: 100,
              duration: {
                triggerMs: 16 // Must be precise
              }
            }
          ]
        }

        matcher.addSequence(sonicBoom)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Hold Back to charge
        matcher.handleFrame(createFrame([37], [37], [], now, 0))
        vi.advanceTimersByTime(1200)

        // Keep charging
        matcher.handleFrame(createFrame([], [37], [], now + 1200, 1))
        vi.advanceTimersByTime(100)

        // Release Back and press Forward + Punch
        matcher.handleFrame(createFrame([39, 80], [39, 80], [37], now + 1300, 2))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['sonic-boom'])
      })

      it('should detect Flash Kick (charge down, up + kick)', () => {
        matcher.addSequence(flashKick)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Hold Down to charge
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(1200)

        // Keep charging
        matcher.handleFrame(createFrame([], [40], [], now + 1200, 1))
        vi.advanceTimersByTime(100)

        // Release Down and press Up + Kick
        matcher.handleFrame(createFrame([38, 75], [38, 75], [40], now + 1300, 2))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['flash-kick'])
      })

      it('should detect Double Flash Kick (charge down, up + kick, down-up + kick)', () => {
        const doubleFlashKick: InputSequence = {
          id: 'double-flash-kick',
          type: 'SEQUENCE',
          timeoutMs: 3000,
          steps: [
            {
              type: 'STATE',
              pressed: [40], // Down charge
              held: [40], // Down charge
              toleranceMs: 100,
              duration: {
                minMs: 1000,
                maxMs: 5000
              }
            },
            {
              type: 'STATE',
              pressed: [38, 75], // Up + Kick (first flash kick)
              held: [38, 75], // Up + Kick (first flash kick)
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              pressed: [40], // Quick Down
              held: [40], // Quick Down
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              pressed: [38, 75], // Up + Kick again (second flash kick)
              held: [38, 75], // Up + Kick again (second flash kick)
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(doubleFlashKick)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Hold Down to charge
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(1200)

        // First Flash Kick: Up + Kick
        matcher.handleFrame(createFrame([38, 75], [38, 75], [40], now + 1200, 1))
        vi.advanceTimersByTime(100)

        // Quick Down
        matcher.handleFrame(createFrame([40], [40], [38, 75], now + 1300, 2))
        vi.advanceTimersByTime(100)

        // Second Flash Kick: Up + Kick
        matcher.handleFrame(createFrame([38, 75], [38, 75], [40], now + 1400, 3))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['double-flash-kick'])
      })
    })

    describe('Zangief Moves', () => {
      it('should detect 360° Spinning Piledriver from down start', () => {
        const spd: InputSequence = {
          id: 'spinning-piledriver',
          type: 'SEQUENCE',
          timeoutMs: 800, // Must complete within 800ms
          steps: [
            {
              type: 'STATE',
              held: [40], // Down
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [39], // Right
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [38], // Up
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [37], // Left
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [80], // Punch
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(spd)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Start with Down
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(100)

        // Move to Right
        matcher.handleFrame(createFrame([39], [39], [40], now + 100, 1))
        vi.advanceTimersByTime(100)

        // Move to Up
        matcher.handleFrame(createFrame([38], [38], [39], now + 200, 2))
        vi.advanceTimersByTime(100)

        // Move to Left
        matcher.handleFrame(createFrame([37], [37], [38], now + 300, 3))
        vi.advanceTimersByTime(100)

        // Press Punch while holding Left
        matcher.handleFrame(createFrame([80], [37, 80], [], now + 400, 4))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['spinning-piledriver'])
      })

      it('should detect Running Bear Grab (720° rotation)', () => {
        const rbg: InputSequence = {
          id: 'running-bear-grab',
          type: 'SEQUENCE',
          timeoutMs: 1200, // Slightly more time for double rotation
          steps: [
            // First 360°
            {
              type: 'STATE',
              held: [40], // Down
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [39], // Right
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [38], // Up
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [37], // Left
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            // Second 360°
            {
              type: 'STATE',
              held: [40], // Down again
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [39], // Right again
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [38], // Up again
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [37, 80], // Left + Punch
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(rbg)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // First 360°
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(100)
        matcher.handleFrame(createFrame([39], [39], [40], now + 100, 1))
        vi.advanceTimersByTime(100)
        matcher.handleFrame(createFrame([38], [38], [39], now + 200, 2))
        vi.advanceTimersByTime(100)
        matcher.handleFrame(createFrame([37], [37], [38], now + 300, 3))
        vi.advanceTimersByTime(100)

        // Second 360°
        matcher.handleFrame(createFrame([40], [40], [37], now + 400, 4))
        vi.advanceTimersByTime(100)
        matcher.handleFrame(createFrame([39], [39], [40], now + 500, 5))
        vi.advanceTimersByTime(100)
        matcher.handleFrame(createFrame([38], [38], [39], now + 600, 6))
        vi.advanceTimersByTime(100)
        matcher.handleFrame(createFrame([37, 80], [37, 80], [38], now + 700, 7))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['running-bear-grab'])
      })
    })

    describe('Vega Moves', () => {
      it('should detect Rolling Crystal Flash', () => {
        const rcf: InputSequence = {
          id: 'rolling-crystal-flash',
          type: 'SEQUENCE',
          timeoutMs: 2000,
          steps: [
            {
              type: 'STATE',
              held: [40], // Down charge
              toleranceMs: 100,
              duration: {
                minMs: 1000,
                maxMs: 5000
              }
            },
            {
              type: 'STATE',
              held: [38, 80], // Up + Punch
              released: [40], // Must release Down
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(rcf)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Hold Down to charge
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(1200)

        // Keep charging
        matcher.handleFrame(createFrame([], [40], [], now + 1200, 1))
        vi.advanceTimersByTime(100)

        // Release Down and press Up + Punch
        matcher.handleFrame(createFrame([38, 80], [38, 80], [40], now + 1300, 2))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['rolling-crystal-flash'])
      })

      it('should detect Rolling Crystal Flash with follow-ups', () => {
        const rcfCombo: InputSequence = {
          id: 'rolling-crystal-flash-combo',
          type: 'SEQUENCE',
          timeoutMs: 3000,
          steps: [
            {
              type: 'STATE',
              held: [40], // Down charge
              toleranceMs: 100,
              duration: {
                minMs: 1000,
                maxMs: 5000
              }
            },
            {
              type: 'STATE',
              held: [38, 80], // Up + Punch
              released: [40], // Must release Down
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [80], // Second Punch
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [80], // Third Punch
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(rcfCombo)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Hold Down to charge
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(1200)

        // Keep charging
        matcher.handleFrame(createFrame([], [40], [], now + 1200, 1))
        vi.advanceTimersByTime(100)

        // Release Down and press Up + Punch
        matcher.handleFrame(createFrame([38, 80], [38, 80], [40], now + 1300, 2))
        vi.advanceTimersByTime(100)

        // Second Punch
        matcher.handleFrame(createFrame([80], [80], [38], now + 1400, 3))
        vi.advanceTimersByTime(100)

        // Third Punch
        matcher.handleFrame(createFrame([80], [80], [], now + 1500, 4))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['rolling-crystal-flash-combo'])
      })
    })

    describe('Rapid Input Moves', () => {
      it('should detect E. Honda Hundred Hand Slap', () => {
        const hundredHandSlap: InputSequence = {
          id: 'hundred-hand-slap',
          type: 'SEQUENCE',
          timeoutMs: 1000,
          steps: [
            {
              type: 'STATE',
              held: [80], // First Punch
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 100
              }
            },
            {
              type: 'STATE',
              held: [80], // Second Punch
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 100
              }
            },
            {
              type: 'STATE',
              held: [80], // Third Punch
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(hundredHandSlap)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // First rapid punch
        matcher.handleFrame(createFrame([80], [80], [], now, 0))
        vi.advanceTimersByTime(50)
        matcher.handleFrame(createFrame([], [], [80], now + 50, 1))
        vi.advanceTimersByTime(16)

        // Second rapid punch
        matcher.handleFrame(createFrame([80], [80], [], now + 66, 2))
        vi.advanceTimersByTime(50)
        matcher.handleFrame(createFrame([], [], [80], now + 116, 3))
        vi.advanceTimersByTime(16)

        // Third rapid punch
        matcher.handleFrame(createFrame([80], [80], [], now + 132, 4))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['hundred-hand-slap'])
      })

      it('should detect Chun-Li Lightning Kicks', () => {
        const lightningKicks: InputSequence = {
          id: 'lightning-kicks',
          type: 'SEQUENCE',
          timeoutMs: 1000,
          steps: [
            {
              type: 'STATE',
              held: [75], // First Kick
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 100
              }
            },
            {
              type: 'STATE',
              held: [75], // Second Kick
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 100
              }
            },
            {
              type: 'STATE',
              held: [75], // Third Kick
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(lightningKicks)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // First rapid kick
        matcher.handleFrame(createFrame([75], [75], [], now, 0))
        vi.advanceTimersByTime(50)
        matcher.handleFrame(createFrame([], [], [75], now + 50, 1))
        vi.advanceTimersByTime(16)

        // Second rapid kick
        matcher.handleFrame(createFrame([75], [75], [], now + 66, 2))
        vi.advanceTimersByTime(50)
        matcher.handleFrame(createFrame([], [], [75], now + 116, 3))
        vi.advanceTimersByTime(16)

        // Third rapid kick
        matcher.handleFrame(createFrame([75], [75], [], now + 132, 4))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['lightning-kicks'])
      })

      it('should detect rapid inputs with varying timing within tolerance', () => {
        const rapidInputs: InputSequence = {
          id: 'rapid-inputs',
          type: 'SEQUENCE',
          timeoutMs: 1000,
          steps: [
            {
              type: 'STATE',
              held: [80], // First press
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 150 // More lenient max time
              }
            },
            {
              type: 'STATE',
              held: [80], // Second press
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 150
              }
            },
            {
              type: 'STATE',
              held: [80], // Third press
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(rapidInputs)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // First press - slightly slower
        matcher.handleFrame(createFrame([80], [80], [], now, 0))
        vi.advanceTimersByTime(70)
        matcher.handleFrame(createFrame([], [], [80], now + 70, 1))
        vi.advanceTimersByTime(20)

        // Second press - very quick
        matcher.handleFrame(createFrame([80], [80], [], now + 90, 2))
        vi.advanceTimersByTime(30)
        matcher.handleFrame(createFrame([], [], [80], now + 120, 3))
        vi.advanceTimersByTime(20)

        // Third press - medium speed
        matcher.handleFrame(createFrame([80], [80], [], now + 140, 4))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['rapid-inputs'])
      })
    })
  })

  describe('Advanced Input Patterns', () => {
    beforeEach(() => {
      matcher.setDebug(true)
      matcher.removeAllSequences()
    })

    describe('Duration Checks', () => {
      it('should fail if keys are released before minMs', () => {
        const holdSequence: InputSequence = {
          id: 'hold-test',
          type: 'STATE',
          held: [32, 17], // Space + Ctrl
          toleranceMs: 100,
          duration: {
            minMs: 500,
            maxMs: 1000
          }
        }

        matcher.addSequence(holdSequence)
        const detected: string[] = []
        const failures: string[] = []

        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        matcher.on('sequence:failed', (event) => {
          failures.push(event.reason)
        })

        // Press both keys
        matcher.handleFrame(createFrame([32, 17], [32, 17], [], now, 0))
        vi.advanceTimersByTime(200)

        // Release one key too early
        matcher.handleFrame(createFrame([], [32], [17], now + 200, 1))
        vi.advanceTimersByTime(100)

        expect(detected).toEqual([])
        expect(failures).toContain('state_lost')
      })

      it('should fail if keys are held beyond maxMs', () => {
        const holdSequence: InputSequence = {
          id: 'hold-test',
          type: 'STATE',
          held: [32], // Space
          toleranceMs: 100,
          duration: {
            minMs: 500,
            maxMs: 1000
          }
        }

        matcher.addSequence(holdSequence)
        const detected: string[] = []
        const failures: string[] = []

        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        matcher.on('sequence:failed', (event) => {
          failures.push(event.reason)
        })

        // Press Space
        matcher.handleFrame(createFrame([32], [32], [], now, 0))
        vi.advanceTimersByTime(1100) // Hold beyond maxMs

        // Still holding
        matcher.handleFrame(createFrame([], [32], [], now + 1100, 1))
        vi.advanceTimersByTime(100)

        expect(detected).toEqual([])
        expect(failures).toContain('duration_exceeded')
      })

      it('should trigger at exact triggerMs timing', () => {
        const triggerSequence: InputSequence = {
          id: 'trigger-test',
          type: 'STATE',
          held: [32], // Space
          toleranceMs: 100,
          duration: {
            triggerMs: 750
          }
        }

        matcher.addSequence(triggerSequence)
        const detected: string[] = []

        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Press Space
        matcher.handleFrame(createFrame([32], [32], [], now, 0))
        vi.advanceTimersByTime(750) // Advance to exact trigger time

        // Still holding at trigger point
        matcher.handleFrame(createFrame([], [32], [], now + 750, 1))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['trigger-test'])
      })

      it('should handle multiple simultaneous hold sequences', () => {
        const holdA: InputSequence = {
          id: 'hold-a',
          type: 'STATE',
          held: [32], // Space
          toleranceMs: 100,
          duration: {
            minMs: 500,
            maxMs: 1000
          }
        }

        const holdB: InputSequence = {
          id: 'hold-b',
          type: 'STATE',
          held: [17], // Ctrl
          toleranceMs: 100,
          duration: {
            minMs: 300,
            maxMs: 800
          }
        }

        matcher.addSequence(holdA)
        matcher.addSequence(holdB)
        const detected: string[] = []

        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Press both keys
        matcher.handleFrame(createFrame([32, 17], [32, 17], [], now, 0))
        vi.advanceTimersByTime(600)

        // Still holding both
        matcher.handleFrame(createFrame([], [32, 17], [], now + 600, 1))
        vi.advanceTimersByTime(100)

        // Both should be detected as they're within their respective ranges
        expect(detected).toContain('hold-a')
        expect(detected).toContain('hold-b')
        expect(detected.length).toBe(2)
      })

      it('should prioritize triggerMs over minMs/maxMs when both are specified', () => {
        const complexSequence: InputSequence = {
          id: 'complex-timing',
          type: 'STATE',
          held: [32], // Space
          toleranceMs: 100,
          duration: {
            minMs: 500,
            maxMs: 1000,
            triggerMs: 750
          }
        }

        matcher.addSequence(complexSequence)
        const detected: string[] = []
        const failures: string[] = []

        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        matcher.on('sequence:failed', (event) => {
          failures.push(event.reason)
        })

        // Press Space
        matcher.handleFrame(createFrame([32], [32], [], now, 0))
        vi.advanceTimersByTime(750) // Advance to trigger time

        // Still holding at trigger point
        matcher.handleFrame(createFrame([], [32], [], now + 750, 1))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['complex-timing'])
        expect(failures).toEqual([]) // Should not fail even though we're within minMs/maxMs range
      })

      it('should only trigger once for triggerMs state sequences', () => {
        const triggerSequence: InputSequence = {
          id: 'single-trigger',
          type: 'STATE' as const,
          held: [40], // Down key
          toleranceMs: 100,
          duration: {
            triggerMs: 100,
            maxMs: 200 // Add maxMs to ensure we don't retrigger
          }
        }

        matcher.addSequence(triggerSequence)
        const detected: string[] = []

        matcher.on('sequence:complete', (event) => {
          console.log('sequence:complete', event)
          detected.push(event.id)
        })

        // Press key
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(100) // Hit trigger point

        // Continue holding to trigger
        matcher.handleFrame(createFrame([], [40], [], now + 100, 1))
        vi.advanceTimersByTime(100)

        // This should not trigger a second time because the triggerMs has hit and the sequence is complete
        matcher.handleFrame(createFrame([], [], [40], now + 150, 2))
        vi.advanceTimersByTime(50)

        // Should only trigger once
        expect(detected).toEqual(['single-trigger'])
        expect(detected.length).toBe(1)
      })
    })
  })
})
