import { describe, it, expect, vi } from 'vitest'
import type { MoveDefinition } from '../../types'
import { lightHadouken, mediumHadouken, heavyHadouken } from '../hadouken'
import { lightDragonPunch, mediumDragonPunch, heavyDragonPunch } from '../dragon-punch'

describe('Move Definitions', () => {
  // Helper function to verify move structure
  const verifyMoveDefinition = (move: MoveDefinition) => {
    expect(move).toHaveProperty('name')
    expect(move).toHaveProperty('steps')
    expect(move).toHaveProperty('priority')
    expect(move).toHaveProperty('strength')
    expect(move.steps).toBeInstanceOf(Array)
    expect(typeof move.name).toBe('string')
    expect(typeof move.priority).toBe('number')
    expect(typeof move.strength).toBe('number')
    expect(move.onComplete).toBeInstanceOf(Function)
    expect(move.onFail).toBeInstanceOf(Function)
  }

  describe('Hadouken Moves', () => {
    it('should have valid MoveDefinition structure', () => {
      verifyMoveDefinition(lightHadouken)
      verifyMoveDefinition(mediumHadouken)
      verifyMoveDefinition(heavyHadouken)
    })

    it('should define Light Hadouken correctly', () => {
      expect(lightHadouken.name).toBe('Light Hadouken')
      expect(lightHadouken.priority).toBe(2)
      expect(lightHadouken.strength).toBe(1)
      expect(lightHadouken.steps).toHaveLength(3)
      expect(lightHadouken.steps[0]).toEqual({
        type: 'press',
        keys: ['Down'],
        maxGapMs: 300 // 200 * 1.5 DIFFICULTY_SCALING_FACTOR
      })
    })

    it('should define Medium Hadouken correctly', () => {
      expect(mediumHadouken.name).toBe('Medium Hadouken')
      expect(mediumHadouken.priority).toBe(2)
      expect(mediumHadouken.strength).toBe(2)
      expect(mediumHadouken.steps).toHaveLength(3)
      expect(mediumHadouken.steps[2]).toEqual({
        type: 'press',
        keys: ['O'],
        maxGapMs: 375 // 250 * 1.5 DIFFICULTY_SCALING_FACTOR
      })
    })

    it('should define Heavy Hadouken correctly', () => {
      expect(heavyHadouken.name).toBe('Heavy Hadouken')
      expect(heavyHadouken.priority).toBe(2)
      expect(heavyHadouken.strength).toBe(3)
      expect(heavyHadouken.steps).toHaveLength(3)
      expect(heavyHadouken.steps[2]).toEqual({
        type: 'press',
        keys: ['P'],
        maxGapMs: 375 // 250 * 1.5 DIFFICULTY_SCALING_FACTOR
      })
    })

    it('should call onComplete with ASCII art when Hadouken succeeds', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      heavyHadouken.onComplete?.()
      expect(consoleSpy).toHaveBeenCalledWith(
        '\x1b[31m%s\x1b[0m',
        expect.stringContaining('HADOUKEN') && expect.stringContaining('HEAVY HADOUKEN!!!')
      )
      consoleSpy.mockRestore()
    })

    it('should call onFail when Hadouken fails', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      heavyHadouken.onFail?.()
      expect(consoleSpy).toHaveBeenCalledWith('Heavy Hadouken failed')
      consoleSpy.mockRestore()
    })
  })

  describe('Dragon Punch Moves', () => {
    it('should have valid MoveDefinition structure', () => {
      verifyMoveDefinition(lightDragonPunch)
      verifyMoveDefinition(mediumDragonPunch)
      verifyMoveDefinition(heavyDragonPunch)
    })

    it('should define Light Dragon Punch correctly', () => {
      expect(lightDragonPunch.name).toBe('Light Dragon Punch')
      expect(lightDragonPunch.priority).toBe(3) // Higher than Hadouken
      expect(lightDragonPunch.strength).toBe(1)
      expect(lightDragonPunch.steps).toHaveLength(4)
      expect(lightDragonPunch.steps[0]).toEqual({
        type: 'press',
        keys: ['Right'],
        maxGapMs: 300 // 200 * 1.5 DIFFICULTY_SCALING_FACTOR
      })
    })

    it('should define Medium Dragon Punch correctly', () => {
      expect(mediumDragonPunch.name).toBe('Medium Dragon Punch')
      expect(mediumDragonPunch.priority).toBe(3)
      expect(mediumDragonPunch.strength).toBe(2)
      expect(mediumDragonPunch.steps).toHaveLength(4)
      expect(mediumDragonPunch.steps[3]).toEqual({
        type: 'press',
        keys: ['O'],
        maxGapMs: 375 // 250 * 1.5 DIFFICULTY_SCALING_FACTOR
      })
    })

    it('should define Heavy Dragon Punch correctly', () => {
      expect(heavyDragonPunch.name).toBe('Heavy Dragon Punch')
      expect(heavyDragonPunch.priority).toBe(3)
      expect(heavyDragonPunch.strength).toBe(3)
      expect(heavyDragonPunch.steps).toHaveLength(4)
      expect(heavyDragonPunch.steps[3]).toEqual({
        type: 'press',
        keys: ['P'],
        maxGapMs: 375 // 250 * 1.5 DIFFICULTY_SCALING_FACTOR
      })
    })

    it('should call onComplete with ASCII art when Dragon Punch succeeds', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      heavyDragonPunch.onComplete?.()
      expect(consoleSpy).toHaveBeenCalledWith(
        '\x1b[31m%s\x1b[0m',
        expect.stringContaining('SHORYUKEN') && expect.stringContaining('HEAVY DRAGON PUNCH!!!')
      )
      consoleSpy.mockRestore()
    })

    it('should call onFail when Dragon Punch fails', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      heavyDragonPunch.onFail?.()
      expect(consoleSpy).toHaveBeenCalledWith('Heavy Dragon Punch failed')
      consoleSpy.mockRestore()
    })
  })

  describe('Move Priorities', () => {
    it('should have Dragon Punch moves with higher priority than Hadouken moves', () => {
      // Test all combinations
      expect(lightDragonPunch.priority).toBeGreaterThan(lightHadouken.priority)
      expect(lightDragonPunch.priority).toBeGreaterThan(mediumHadouken.priority)
      expect(lightDragonPunch.priority).toBeGreaterThan(heavyHadouken.priority)

      expect(mediumDragonPunch.priority).toBeGreaterThan(lightHadouken.priority)
      expect(mediumDragonPunch.priority).toBeGreaterThan(mediumHadouken.priority)
      expect(mediumDragonPunch.priority).toBeGreaterThan(heavyHadouken.priority)

      expect(heavyDragonPunch.priority).toBeGreaterThan(lightHadouken.priority)
      expect(heavyDragonPunch.priority).toBeGreaterThan(mediumHadouken.priority)
      expect(heavyDragonPunch.priority).toBeGreaterThan(heavyHadouken.priority)
    })

    it('should have consistent strength values within move types', () => {
      // Hadouken strength progression
      expect(lightHadouken.strength).toBe(1)
      expect(mediumHadouken.strength).toBe(2)
      expect(heavyHadouken.strength).toBe(3)

      // Dragon Punch strength progression
      expect(lightDragonPunch.strength).toBe(1)
      expect(mediumDragonPunch.strength).toBe(2)
      expect(heavyDragonPunch.strength).toBe(3)
    })
  })
})
