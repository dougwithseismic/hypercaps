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
              held: [40], // Down charge
              toleranceMs: 100,
              duration: {
                minMs: 1000,
                maxMs: 5000
              }
            },
            {
              type: 'STATE',
              held: [38, 75], // Up + Kick (first flash kick)
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
              held: [40], // Quick Down
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 200
              }
            },
            {
              type: 'STATE',
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

      it('should only allow Super Flash Kick after recent Flash Kick', () => {
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
                minMs: 1000,
                maxMs: 5000
              }
            },
            {
              type: 'STATE',
              held: [38, 75], // Up + Kick
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        const superFlashKick: InputSequence = {
          id: 'super-flash-kick',
          type: 'SEQUENCE',
          timeoutMs: 2000,
          relationships: [
            {
              type: 'REQUIRES',
              targetSequenceId: 'flash-kick',
              timeWindowMs: 1000 // Must be within 1 second of Flash Kick
            }
          ],
          steps: [
            {
              type: 'STATE',
              held: [40], // Down charge
              toleranceMs: 100,
              duration: {
                minMs: 500, // Shorter charge time for super
                maxMs: 5000
              }
            },
            {
              type: 'STATE',
              held: [38], // Up
              toleranceMs: 100,
              duration: {
                minMs: 16,
                maxMs: 100
              }
            },
            {
              type: 'STATE',
              held: [75, 76, 77], // LK, MK, HK
              toleranceMs: 100,
              duration: {
                triggerMs: 16
              }
            }
          ]
        }

        matcher.addSequence(flashKick)
        matcher.addSequence(superFlashKick)

        const detected: string[] = []
        matcher.on('sequence:complete', (event) => {
          detected.push(event.id)
        })

        // Try Super Flash Kick without Flash Kick first - should fail
        matcher.handleFrame(createFrame([40], [40], [], now, 0))
        vi.advanceTimersByTime(600)
        matcher.handleFrame(createFrame([38], [38], [40], now + 600, 1))
        vi.advanceTimersByTime(16)
        matcher.handleFrame(createFrame([75, 76, 77], [75, 76, 77], [], now + 2648, 11))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual([]) // Should not detect super without flash kick

        // Now do Flash Kick
        matcher.handleFrame(createFrame([40], [40], [], now + 700, 5))
        vi.advanceTimersByTime(1200)
        matcher.handleFrame(createFrame([38, 75], [38, 75], [40], now + 1900, 6))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['flash-kick']) // Should detect flash kick
        expect(detected.length).toBe(1)

        // Now try Super Flash Kick right after - should work
        matcher.handleFrame(createFrame([40], [40], [], now + 2000, 7))
        vi.advanceTimersByTime(600)
        matcher.handleFrame(createFrame([38], [38], [40], now + 2600, 8))
        vi.advanceTimersByTime(16)
        matcher.handleFrame(createFrame([75, 76, 77], [75, 76, 77], [], now + 2648, 11))
        vi.advanceTimersByTime(1600)

        expect(detected).toEqual(['flash-kick', 'super-flash-kick'])

        // // Wait too long and try Super Flash Kick again - should fail
        vi.advanceTimersByTime(2000) // Wait 2 seconds
        matcher.handleFrame(createFrame([40], [40], [], now + 4700, 12))
        vi.advanceTimersByTime(600)
        matcher.handleFrame(createFrame([38], [38], [40], now + 5300, 13))
        vi.advanceTimersByTime(16)
        matcher.handleFrame(createFrame([75], [75], [], now + 5316, 14))
        vi.advanceTimersByTime(16)
        matcher.handleFrame(createFrame([76], [76], [], now + 5332, 15))
        vi.advanceTimersByTime(16)
        matcher.handleFrame(createFrame([77], [77], [], now + 5348, 16))
        vi.advanceTimersByTime(16)

        expect(detected).toEqual(['flash-kick', 'super-flash-kick']) // No additional detection
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

    it('should detect a charge move with Ctrl+Space held and Space release', () => {
      const chargeMove: InputSequence = {
        id: 'charge-move',
        type: 'SEQUENCE',
        timeoutMs: 2000,
        steps: [
          {
            type: 'STATE',
            held: [17, 32], // Ctrl + Space
            toleranceMs: 100,
            duration: {
              minMs: 500, // Must hold for at least 500ms
              maxMs: 2000
            }
          },
          {
            type: 'STATE',
            held: [17], // Still holding Ctrl
            released: [32], // But Space is released
            toleranceMs: 100,
            duration: {
              minMs: 0,
              maxMs: 200
            }
          }
        ]
      }

      matcher.addSequence(chargeMove)

      const detected: string[] = []
      matcher.on('sequence:complete', (event) => {
        detected.push(event.id)
      })

      // Press Ctrl+Space together
      matcher.handleFrame(createFrame([17, 32], [17, 32], [], now, 0))
      vi.advanceTimersByTime(600)

      // Hold both keys
      matcher.handleFrame(createFrame([], [17, 32], [], now + 600, 1))
      vi.advanceTimersByTime(100)

      // Release Space but keep Ctrl held
      matcher.handleFrame(createFrame([], [17], [32], now + 700, 2))
      vi.advanceTimersByTime(100)

      expect(detected).toEqual(['charge-move'])
    })

    it('should detect a perfect block with precise Ctrl press while holding Space', () => {
      const perfectBlock: InputSequence = {
        id: 'perfect-block',
        type: 'SEQUENCE',
        timeoutMs: 1000,
        steps: [
          {
            type: 'STATE',
            held: [32], // Space held first
            toleranceMs: 100,
            duration: {
              minMs: 100,
              maxMs: 1000
            }
          },
          {
            type: 'STATE',
            held: [17, 32], // Ctrl pressed while holding Space
            toleranceMs: 100,
            duration: {
              triggerMs: 16 // Must be very precise timing
            }
          }
        ]
      }

      matcher.addSequence(perfectBlock)

      const detected: string[] = []
      matcher.on('sequence:complete', (event) => {
        detected.push(event.id)
      })

      // Press and hold Space
      matcher.handleFrame(createFrame([32], [32], [], now, 0))
      vi.advanceTimersByTime(200)

      // Keep holding Space
      matcher.handleFrame(createFrame([], [32], [], now + 200, 1))
      vi.advanceTimersByTime(100)

      // Press Ctrl while still holding Space
      matcher.handleFrame(createFrame([17], [17, 32], [], now + 300, 2))
      vi.advanceTimersByTime(16)

      expect(detected).toEqual(['perfect-block'])
    })

    it('should detect a counter by releasing Space right after Ctrl press', () => {
      const counter: InputSequence = {
        id: 'counter',
        type: 'SEQUENCE',
        timeoutMs: 1000,
        steps: [
          {
            type: 'STATE',
            held: [32], // Space held
            toleranceMs: 100,
            duration: {
              minMs: 100,
              maxMs: 1000
            }
          },
          {
            type: 'STATE',
            held: [17, 32], // Ctrl pressed while holding Space
            toleranceMs: 100,
            duration: {
              minMs: 16,
              maxMs: 100
            }
          },
          {
            type: 'STATE',
            held: [17], // Only Ctrl held
            released: [32], // Space must be released
            toleranceMs: 100,
            duration: {
              triggerMs: 16 // Must release Space quickly after Ctrl press
            }
          }
        ]
      }

      matcher.addSequence(counter)

      const detected: string[] = []
      matcher.on('sequence:complete', (event) => {
        detected.push(event.id)
      })

      // Press and hold Space
      matcher.handleFrame(createFrame([32], [32], [], now, 0))
      vi.advanceTimersByTime(200)

      // Keep holding Space
      matcher.handleFrame(createFrame([], [32], [], now + 200, 1))
      vi.advanceTimersByTime(100)

      // Press Ctrl while still holding Space
      matcher.handleFrame(createFrame([17], [17, 32], [], now + 300, 2))
      vi.advanceTimersByTime(16)

      // Release Space but keep Ctrl held
      matcher.handleFrame(createFrame([], [17], [32], now + 316, 3))
      vi.advanceTimersByTime(16)

      expect(detected).toEqual(['counter'])
    })
  })

  describe('Sequence Relationships', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })
    // Helper functions
    const createMatcher = () => {
      const matcher = new SequenceMatcher()
      matcher.setDebug(true)
      const completedSequences: string[] = []

      matcher.on('sequence:complete', (event) => {
        completedSequences.push(event.id)
      })

      return { matcher, completedSequences }
    }

    const pressKey = (
      matcher: SequenceMatcher,
      key: number,
      timestamp: number,
      frameNumber: number
    ) => {
      matcher.handleFrame({
        timestamp,
        frameNumber,
        justPressed: new Set([key]),
        heldKeys: new Set([key]),
        justReleased: new Set()
      })
    }

    const holdKey = (
      matcher: SequenceMatcher,
      key: number,
      timestamp: number,
      frameNumber: number
    ) => {
      matcher.handleFrame({
        timestamp,
        frameNumber,
        justPressed: new Set(),
        heldKeys: new Set([key]),
        justReleased: new Set()
      })
    }

    const releaseKey = (
      matcher: SequenceMatcher,
      key: number,
      heldKeys: number[],
      timestamp: number,
      frameNumber: number
    ) => {
      matcher.handleFrame({
        timestamp,
        frameNumber,
        justPressed: new Set(),
        heldKeys: new Set(heldKeys),
        justReleased: new Set([key])
      })
    }

    it('should prevent executing a sequence when PREVENTS relationship is active', () => {
      const { matcher, completedSequences } = createMatcher()

      // Add a basic sequence that will prevent others
      const blockingSequence = {
        id: 'blocking-move',
        type: 'STATE' as const,
        held: [40], // Down key
        toleranceMs: 100,
        duration: { triggerMs: 100 }
      }

      // Add a sequence that should be prevented
      const preventedSequence = {
        id: 'prevented-move',
        type: 'STATE' as const,
        held: [38], // Up key
        toleranceMs: 100,
        duration: { triggerMs: 100 },
        relationships: [
          {
            type: 'PREVENTS' as const,
            targetSequenceId: 'blocking-move',
            timeWindowMs: 500
          }
        ]
      }

      matcher.addSequence(blockingSequence)
      matcher.addSequence(preventedSequence)

      // Execute blocking sequence
      pressKey(matcher, 40, 1000, 0)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 40, 1100, 1)
      vi.advanceTimersByTime(100)

      // Try to execute prevented sequence within prevention window
      releaseKey(matcher, 40, [38], 1200, 2)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 38, 1300, 3)
      vi.advanceTimersByTime(100)

      expect(completedSequences).toEqual(['blocking-move'])
    })

    it('should allow executing a sequence after PREVENTS relationship expires', () => {
      const { matcher, completedSequences } = createMatcher()

      // Add a basic sequence that will prevent others
      const blockingSequence = {
        id: 'blocking-move',
        type: 'STATE' as const,
        held: [40], // Down key
        toleranceMs: 100,
        duration: { triggerMs: 100 }
      }

      // Add a sequence that should be prevented initially
      const preventedSequence = {
        id: 'prevented-move',
        type: 'STATE' as const,
        held: [38], // Up key
        toleranceMs: 100,
        duration: { triggerMs: 100 },
        relationships: [
          {
            type: 'PREVENTS' as const,
            targetSequenceId: 'blocking-move',
            timeWindowMs: 500
          }
        ]
      }

      matcher.addSequence(blockingSequence)
      matcher.addSequence(preventedSequence)

      // Execute blocking sequence
      pressKey(matcher, 40, 1000, 0)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 40, 1100, 1)
      vi.advanceTimersByTime(500)

      // Try to execute prevented sequence after prevention window
      releaseKey(matcher, 40, [38], 1600, 2)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 38, 1700, 3)
      vi.advanceTimersByTime(100)

      expect(completedSequences).toEqual(['blocking-move', 'prevented-move'])
    })

    it('should require a specific sequence before allowing execution', () => {
      const { matcher, completedSequences } = createMatcher()

      // Add a prerequisite sequence
      const prerequisiteSequence = {
        id: 'prerequisite-move',
        type: 'STATE' as const,
        held: [40], // Down key
        toleranceMs: 100,
        duration: { triggerMs: 100 }
      }

      // Add a sequence that requires the prerequisite
      const dependentSequence = {
        id: 'dependent-move',
        type: 'STATE' as const,
        held: [38], // Up key
        toleranceMs: 100,
        duration: { triggerMs: 100 },
        relationships: [
          {
            type: 'REQUIRES' as const,
            targetSequenceId: 'prerequisite-move',
            timeWindowMs: 500
          }
        ]
      }

      matcher.removeAllSequences()
      matcher.addSequence(prerequisiteSequence)
      matcher.addSequence(dependentSequence)

      // Try dependent sequence without prerequisite
      pressKey(matcher, 38, 1000, 0)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 38, 1100, 1)
      vi.advanceTimersByTime(100)

      expect(completedSequences).toEqual([])

      // Execute prerequisite sequence
      pressKey(matcher, 40, 1200, 2)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 40, 1300, 3)
      vi.advanceTimersByTime(100)

      expect(completedSequences).toEqual(['prerequisite-move'])

      // Now try dependent sequence
      releaseKey(matcher, 40, [38], 1400, 4)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 38, 1500, 5)
      vi.advanceTimersByTime(100)

      expect(completedSequences).toEqual(['prerequisite-move', 'dependent-move'])
    })

    it('should handle multiple relationships on a single sequence', () => {
      const { matcher, completedSequences } = createMatcher()

      // Add sequences that will be referenced in relationships
      const sequence1 = {
        id: 'sequence1',
        type: 'STATE' as const,
        held: [37], // Left key
        toleranceMs: 100,
        duration: { triggerMs: 100 }
      }

      const sequence2 = {
        id: 'sequence2',
        type: 'STATE' as const,
        held: [39], // Right key
        toleranceMs: 100,
        duration: { triggerMs: 100 }
      }

      // Add a sequence with multiple relationships
      const complexSequence = {
        id: 'complex-move',
        type: 'STATE' as const,
        held: [38], // Up key
        toleranceMs: 100,
        duration: { triggerMs: 100 },
        relationships: [
          {
            type: 'REQUIRES' as const,
            targetSequenceId: 'sequence1',
            timeWindowMs: 1000 // Increased window to allow for the PREVENTS to expire
          },
          {
            type: 'PREVENTS' as const,
            targetSequenceId: 'sequence2',
            timeWindowMs: 500
          }
        ]
      }

      matcher.addSequence(sequence1)
      matcher.addSequence(sequence2)
      matcher.addSequence(complexSequence)

      // Execute sequence1 (required) at t=1000
      pressKey(matcher, 37, 1000, 0)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 37, 1100, 1)
      vi.advanceTimersByTime(100)

      // Execute sequence2 (preventing) at t=1200
      releaseKey(matcher, 37, [39], 1200, 2)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 39, 1300, 3)
      vi.advanceTimersByTime(100)

      // Try complex sequence (should fail due to sequence2) at t=1400
      releaseKey(matcher, 39, [38], 1400, 4)
      vi.advanceTimersByTime(100)
      holdKey(matcher, 38, 1500, 5)
      vi.advanceTimersByTime(300)

      // Wait for prevention window to expire but still within REQUIRES window
      // sequence2 completed at t=1300, so try after t=1800 (500ms prevention window)
      // but before t=2000 (1000ms requires window from sequence1 at t=1000)
      pressKey(matcher, 38, 1850, 6)
      vi.advanceTimersByTime(50)
      holdKey(matcher, 38, 1900, 7)
      vi.advanceTimersByTime(100)

      expect(completedSequences).toEqual(['sequence1', 'sequence2', 'complex-move'])
    })
  })
})
