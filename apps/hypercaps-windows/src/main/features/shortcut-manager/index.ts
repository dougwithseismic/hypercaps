import { EventEmitter } from 'events'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import { RollingWindow } from './rolling-window'
import { shortcutStore } from './store'
import type {
  KeyboardFrame,
  Shortcut,
  ShortcutManagerConfig,
  TriggerStep,
  ShortcutAction
} from './types'

interface MatchState {
  patternId: string
  currentStep: number
  stepStartTime: number
  matchStartTime: number
  matchedKeys: Set<string>
  confidence: number
  completedAt?: number // When the pattern was fully matched
}

interface MatchResult {
  shortcut: Shortcut
  startTime: number
  endTime: number
  confidence: number
  frames: KeyboardFrame[]
}

class ShortcutFeature extends EventEmitter {
  private rollingWindow: RollingWindow
  private lastExecutions: Map<string, number>
  private activeMatches = new Map<string, MatchState>()
  private isInitialized = false
  private isEnabled: boolean
  private config: ShortcutManagerConfig
  private store = shortcutStore
  private enabledShortcuts: Shortcut[] = []
  private cleanupTimer: NodeJS.Timeout | null = null
  private lastCleanupTime = 0
  private readonly CLEANUP_INTERVAL = 1000 // 1s backup cleanup
  private maxWindowsByPattern = new Map<string, number>() // Track max windows per pattern
  private readonly EXECUTION_GRACE_PERIOD = 100 // ms to wait for potential longer combos

  constructor() {
    super()
    this.rollingWindow = new RollingWindow({
      maxFrames: 32,
      maxAgeMs: 5000
    })
    this.lastExecutions = new Map()
    this.config = this.store.get()
    this.isEnabled = this.config.isEnabled
    this.enabledShortcuts = this.config.shortcuts.filter((s) => s.enabled)
    this.updateMaxWindows() // Initialize max windows
  }

  private updateMaxWindows(): void {
    this.maxWindowsByPattern.clear()

    for (const shortcut of this.enabledShortcuts) {
      // Calculate maximum possible window for this pattern
      const maxStepWindow = Math.max(
        ...shortcut.trigger.steps.map((step) => step.conditions?.window ?? 200)
      )
      const maxHoldTime = Math.max(
        ...shortcut.trigger.steps
          .filter((step) => step.type === 'hold')
          .map((step) => step.conditions?.holdTime ?? 0)
      )

      // The maximum time this pattern could possibly take is:
      // max(totalTimeWindow, sum of all step windows, longest hold time)
      const maxPatternWindow = Math.max(
        shortcut.trigger.totalTimeWindow ?? 500,
        maxStepWindow * shortcut.trigger.steps.length,
        maxHoldTime
      )

      this.maxWindowsByPattern.set(shortcut.id, maxPatternWindow)
    }

    console.log(
      '[ShortcutFeature] Updated max windows:',
      Object.fromEntries(this.maxWindowsByPattern.entries())
    )
  }

  async initialize(): Promise<void> {
    console.log('[ShortcutFeature] Initializing...')

    try {
      // Validate shortcuts
      await this.validateShortcuts()

      // Subscribe to store changes
      this.store.subscribe((config) => {
        console.log('[ShortcutFeature] Config updated:', config)
        this.config = config
        this.isEnabled = config.isEnabled
        this.enabledShortcuts = this.config.shortcuts.filter((s) => s.enabled)
        this.updateMaxWindows() // Update windows when config changes
        // Validate new shortcuts
        void this.validateShortcuts()
      })

      // Subscribe to keyboard frames
      keyboardService.on('keyboard:frame', this.handleFrameEvent)

      // Start backup cleanup timer
      this.ensureCleanupTimer()

      this.isInitialized = true
      console.log('[ShortcutFeature] Initialized successfully')
    } catch (error) {
      console.error('[ShortcutFeature] Initialization error:', error)
    }
  }

  private async validateShortcuts(): Promise<void> {
    console.log('\n[ShortcutFeature] Validating shortcuts...\n')

    for (const shortcut of this.enabledShortcuts) {
      console.log(`Testing shortcut: ${shortcut.name} (${shortcut.id})`)
      console.log('├─ Steps:')

      const totalKeys = new Set<string>()
      let hasOverlappingKeys = false
      let previousStepKeys = new Set<string>()

      // Test each step
      for (const [index, step] of shortcut.trigger.steps.entries()) {
        console.log(`│  ├─ Step ${index + 1}: ${step.type.toUpperCase()}`)
        console.log(`│  │  ├─ Keys: ${step.keys.join(' + ')}`)
        console.log(`│  │  ├─ Window: ${step.conditions?.window ?? 200}ms`)
        if (step.type === 'hold') {
          console.log(`│  │  ├─ Hold Time: ${step.conditions?.holdTime ?? 0}ms`)
        }
        console.log(`│  │  ├─ Strict: ${step.conditions?.strict ?? true}`)

        // Check for progressive actions
        if (step.action) {
          console.log(`│  │  ├─ Has Progressive Action: ${step.action.type}`)
          if (step.action.type === 'launch') {
            console.log(`│  │  │  └─ Program: ${step.action.program}`)
          } else {
            console.log(`│  │  │  └─ Command: ${step.action.command}`)
          }
        }

        // Check for key overlaps within step
        const stepKeys = new Set(step.keys)
        if (stepKeys.size !== step.keys.length) {
          console.log(`│  │  ├─ ⚠️ Warning: Duplicate keys in step`)
        }

        // Check for overlapping keys with previous step
        const overlappingKeys = Array.from(stepKeys).filter((k) => previousStepKeys.has(k))
        if (overlappingKeys.length > 0) {
          hasOverlappingKeys = true
          console.log(
            `│  │  ├─ ⚠️ Warning: Keys overlap with previous step: ${overlappingKeys.join(', ')}`
          )
        }

        // Add to total keys
        step.keys.forEach((k) => totalKeys.add(k))
        previousStepKeys = stepKeys
      }

      // Overall shortcut analysis
      console.log('├─ Analysis:')
      console.log(`│  ├─ Total Unique Keys: ${totalKeys.size}`)
      console.log(`│  ├─ Total Steps: ${shortcut.trigger.steps.length}`)
      console.log(`│  ├─ Total Window: ${shortcut.trigger.totalTimeWindow}ms`)
      console.log(`│  ├─ Progressive: ${shortcut.trigger.progressive ? 'Yes' : 'No'}`)
      console.log(`│  ├─ Cooldown: ${shortcut.cooldown}ms`)

      // Timing analysis
      const totalStepTime = shortcut.trigger.steps.reduce((total, step) => {
        const window = step.conditions?.window ?? 200
        const holdTime = step.type === 'hold' ? (step.conditions?.holdTime ?? 0) : 0
        return total + Math.max(window, holdTime)
      }, 0)

      if (totalStepTime > shortcut.trigger.totalTimeWindow) {
        console.log(
          `│  ├─ ⚠️ Warning: Sum of step times (${totalStepTime}ms) exceeds total window (${shortcut.trigger.totalTimeWindow}ms)`
        )
      }

      if (hasOverlappingKeys) {
        console.log(`│  ├─ ⚠️ Warning: Contains overlapping keys between steps`)
      }

      // Final validation
      const maxWindow = this.maxWindowsByPattern.get(shortcut.id)
      console.log(`│  └─ Max Execution Window: ${maxWindow}ms`)
      console.log('└─ End Test\n')
    }

    console.log('[ShortcutFeature] Shortcut validation complete\n')
  }

  private ensureCleanupTimer(): void {
    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => {
        const now = Date.now()
        // Only run backup cleanup if we haven't cleaned up recently via frames
        if (now - this.lastCleanupTime > this.CLEANUP_INTERVAL) {
          this.cleanupExpiredPatterns(now)
        }
      }, this.CLEANUP_INTERVAL)
    }
  }

  private cleanupExpiredPatterns(now: number): void {
    if (this.activeMatches.size === 0) return

    for (const [patternId, state] of this.activeMatches) {
      const pattern = this.enabledShortcuts.find((s) => s.id === patternId)
      if (!pattern) {
        console.log('[ShortcutFeature] Pattern not found:', patternId)
        this.activeMatches.delete(patternId)
        continue
      }

      const currentStep = pattern.trigger.steps[state.currentStep]
      if (!currentStep) {
        console.log('[ShortcutFeature] Invalid step:', state.currentStep)
        this.activeMatches.delete(patternId)
        continue
      }

      const stepWindow = currentStep.conditions?.window ?? 200
      const totalWindow = pattern.trigger.totalTimeWindow ?? 500
      const maxWindow = this.maxWindowsByPattern.get(patternId) ?? totalWindow
      const stepAge = now - state.stepStartTime
      const totalAge = now - state.matchStartTime

      // If we've exceeded the maximum possible window for this pattern, clean it up
      if (totalAge > maxWindow) {
        // console.log('[ShortcutFeature] Pattern exceeded max window:', {
        //   patternId,
        //   totalAge,
        //   maxWindow,
        //   pattern: pattern.name
        // })
        this.activeMatches.delete(patternId)
        continue
      }

      // Otherwise check normal windows
      if (stepAge > stepWindow) {
        // console.log('[ShortcutFeature] Step window expired:', {
        //   patternId,
        //   stepNumber: state.currentStep,
        //   stepAge,
        //   stepWindow
        // })
        this.activeMatches.delete(patternId)
        continue
      }

      if (totalAge > totalWindow) {
        console.log('[ShortcutFeature] Total window expired:', {
          patternId,
          totalAge,
          totalWindow
        })
        this.activeMatches.delete(patternId)
      }
    }

    this.lastCleanupTime = now
  }

  private handleFrameEvent = (event: KeyboardFrameEvent): void => {
    const frame: KeyboardFrame = {
      id: event.id,
      frame: event.frame,
      timestamp: event.timestamp,
      justPressed: new Set(event.state.justPressed.map(String)),
      heldKeys: new Set(event.state.held.map(String)),
      justReleased: new Set(event.state.justReleased.map(String)),
      holdDurations: new Map(Object.entries(event.state.holdDurations))
    }

    // Add frame to matcher
    this.rollingWindow.addFrame(frame)
    this.findAndExecuteMatches()
  }

  private matchesStep(frame: KeyboardFrame, step: TriggerStep): boolean {
    switch (step.type) {
      case 'combo': {
        // Use optional chaining and nullish coalescing for safe access
        const isStrict = step.conditions?.strict ?? true // Default to true for combos
        const window = step.conditions?.window ?? 200 // Default window of 200ms

        if (isStrict) {
          // All keys must be in justPressed
          return step.keys.every((key) => frame.justPressed.has(key))
        } else {
          // For non-strict combos, we need to handle two cases:
          // 1. Keys that were just pressed (within window)
          // 2. Keys that are being held (regardless of duration)
          return step.keys.every(
            (key) =>
              // If the key was just pressed, it's valid
              frame.justPressed.has(key) ||
              // If the key is held, it's valid (we don't care about duration for combos)
              // This allows for sequences like "hold LShift, then press A while still holding"
              frame.heldKeys.has(key)
          )
        }
      }

      case 'press':
        return step.keys.every((key) => frame.justPressed.has(key))

      case 'release':
        return step.keys.every((key) => frame.justReleased.has(key))

      case 'hold': {
        const holdTime = step.conditions?.holdTime ?? 0
        return step.keys.every(
          (key) => frame.heldKeys.has(key) && frame.holdDurations.get(key)! >= holdTime
        )
      }

      default:
        return false
    }
  }

  private findAndExecuteMatches(): void {
    if (!this.isEnabled || !this.config.isEnabled) return
    const frames = this.rollingWindow.getFrames()
    if (frames.length === 0) return

    const completedMatches: MatchResult[] = []
    const latestFrame = frames[frames.length - 1]
    const now = Date.now()

    // Frame-driven cleanup
    this.cleanupExpiredPatterns(latestFrame.timestamp)
    this.lastCleanupTime = now

    // Process frames for active matches
    for (const frame of frames) {
      // First, update existing matches
      for (const [patternId, state] of this.activeMatches) {
        const pattern = this.enabledShortcuts.find((s) => s.id === patternId)
        if (!pattern) continue

        const currentStep = pattern.trigger.steps[state.currentStep]
        if (!currentStep) {
          this.activeMatches.delete(patternId)
          continue
        }

        // For hold steps, we want to keep updating the state as long as the key is held
        if (currentStep.type === 'hold') {
          if (this.matchesStep(frame, currentStep)) {
            // Update the confidence based on hold duration
            const holdTime = currentStep.conditions?.holdTime ?? 0
            const actualHoldTime = Math.min(frame.timestamp - state.stepStartTime, holdTime)
            state.confidence = (actualHoldTime / holdTime) * currentStep.keys.length * 100

            // If we've met the hold time, move to next step
            if (actualHoldTime >= holdTime) {
              // Execute step action if progressive
              if (pattern.trigger.progressive && currentStep.action) {
                void this.executeAction({
                  action: currentStep.action,
                  shortcutId: pattern.id,
                  stepNumber: state.currentStep
                })
              }

              state.currentStep++
              state.stepStartTime = frame.timestamp
              // Ensure held keys are still valid for next step
              const nextStep = pattern.trigger.steps[state.currentStep]
              if (nextStep?.type === 'combo') {
                const heldKeys = new Set(frame.heldKeys)
                if (!currentStep.keys.every((k) => heldKeys.has(k))) {
                  this.activeMatches.delete(patternId)
                }
              }
            }
          } else {
            // Key was released before hold time
            this.activeMatches.delete(patternId)
          }
          continue
        }

        // For combo steps
        if (currentStep.type === 'combo') {
          if (this.matchesStep(frame, currentStep)) {
            // Execute step action if progressive
            if (pattern.trigger.progressive && currentStep.action) {
              void this.executeAction({
                action: currentStep.action,
                shortcutId: pattern.id,
                stepNumber: state.currentStep
              })
            }

            // Check if this is the last step
            const isLastStep = state.currentStep === pattern.trigger.steps.length - 1

            if (isLastStep) {
              state.completedAt = frame.timestamp // Mark when pattern completed
              completedMatches.push({
                shortcut: pattern,
                startTime: state.matchStartTime,
                endTime: frame.timestamp,
                confidence: state.confidence,
                frames: frames.slice(frames.findIndex((f) => f.timestamp >= state.matchStartTime))
              })
            } else {
              // Only increment step if not the last one
              state.currentStep++
              state.confidence += currentStep.keys.length * 10
              state.stepStartTime = frame.timestamp
            }
          }
        }
      }

      // Try to start new patterns
      for (const pattern of this.enabledShortcuts) {
        const lastExecution = this.lastExecutions.get(pattern.id) || 0
        const cooldown = pattern.cooldown || 500

        // Skip if in cooldown
        if (now - lastExecution < cooldown) continue

        const firstStep = pattern.trigger.steps[0]

        // Check for overlapping patterns
        const hasOverlappingMatch = Array.from(this.activeMatches.values()).some((match) => {
          const matchPattern = this.enabledShortcuts.find((s) => s.id === match.patternId)
          if (!matchPattern) return false
          return this.patternsOverlap(pattern, matchPattern)
        })

        if (!hasOverlappingMatch && this.matchesStep(frame, firstStep)) {
          this.activeMatches.set(pattern.id, {
            patternId: pattern.id,
            currentStep: 0,
            stepStartTime: frame.timestamp,
            matchStartTime: frame.timestamp,
            matchedKeys: new Set(firstStep.keys),
            confidence: firstStep.type === 'hold' ? 0 : firstStep.keys.length * 10
          })
        }
      }
    }

    // Wait for grace period before executing
    const readyToExecute = completedMatches.filter((match) => {
      const state = this.activeMatches.get(match.shortcut.id)
      if (!state?.completedAt) return false
      return latestFrame.timestamp - state.completedAt >= this.EXECUTION_GRACE_PERIOD
    })

    if (readyToExecute.length > 0) {
      // Sort by complexity and confidence
      const bestMatch = readyToExecute.sort((a, b) => {
        // Prefer patterns with more steps
        const stepDiff = b.shortcut.trigger.steps.length - a.shortcut.trigger.steps.length
        if (stepDiff !== 0) return stepDiff
        // Then by confidence
        if (a.confidence !== b.confidence) return b.confidence - a.confidence
        // Finally by completion time
        return b.endTime - a.endTime
      })[0]

      void this.executeShortcut(bestMatch)
    }
  }

  private patternsOverlap(pattern1: Shortcut, pattern2: Shortcut): boolean {
    // Check if patterns share any keys in their first steps
    const keys1 = new Set(pattern1.trigger.steps[0].keys)
    const keys2 = new Set(pattern2.trigger.steps[0].keys)
    return Array.from(keys1).some((k) => keys2.has(k))
  }

  private async executeShortcut(match: MatchResult): Promise<void> {
    const now = Date.now()
    const lastExecution = this.lastExecutions.get(match.shortcut.id) || 0
    const cooldown = match.shortcut.cooldown || 500

    if (now - lastExecution < cooldown) {
      console.log(
        `[ShortcutFeature] Skipping execution of ${match.shortcut.id} - in cooldown (${cooldown}ms)`
      )
      return
    }

    try {
      const shortcut = match.shortcut

      console.log(`
      ███████╗██╗  ██╗ ██████╗ ██████╗ ████████╗ ██████╗██╗   ██╗████████╗██╗
      ██╔════╝██║  ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██║   ██║╚══██╔══╝██║
      ███████╗███████║██║   ██║██████╔╝   ██║   ██║     ██║   ██║   ██║   ██║
      ╚════██║██╔══██║██║   ██║██╔══██╗   ██║   ██║     ██║   ██║   ██║   ╚═╝
      ███████║██║  ██║╚██████╔╝██║  ██║   ██║   ╚██████╗╚██████╔╝   ██║   ██╗
      ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝   ╚═╝
      `)
      console.log(`[ShortcutFeature] Would execute shortcut: ${shortcut.name} (${shortcut.id})`)
      console.log(`[ShortcutFeature] Action type: ${shortcut.action.type}`)
      if (shortcut.action.type === 'launch') {
        console.log(`[ShortcutFeature] Would launch: ${shortcut.action.program}`)
      } else if (shortcut.action.type === 'command') {
        console.log(`[ShortcutFeature] Would run command: ${shortcut.action.command}`)
      }

      // Clean up ALL matches for this pattern after successful execution
      this.cleanupPatternMatches(shortcut.id)

      this.emit('shortcut:executed', { shortcut, match })
    } catch (error) {
      console.error('[ShortcutFeature] Error executing shortcut:', error)
      this.emit('shortcut:error', { error, shortcutId: match.shortcut.id })
    } finally {
      this.lastExecutions.set(match.shortcut.id, now)
    }
  }

  private cleanupPatternMatches(patternId: string): void {
    const pattern = this.enabledShortcuts.find((s) => s.id === patternId)
    if (!pattern) return

    // Get all keys from the executed pattern
    const patternKeys = new Set(pattern.trigger.steps.flatMap((step) => step.keys))

    // Remove all active matches that share any keys with this pattern
    for (const [activeId, state] of this.activeMatches) {
      const activePattern = this.enabledShortcuts.find((s) => s.id === activeId)
      if (!activePattern) {
        this.activeMatches.delete(activeId)
        continue
      }

      // Check if patterns share any keys
      const activeKeys = new Set(activePattern.trigger.steps.flatMap((step) => step.keys))
      const hasSharedKeys = Array.from(patternKeys).some((k) => activeKeys.has(k))

      if (hasSharedKeys || activeId === patternId) {
        console.log(
          `[ShortcutFeature] Cleaning up related pattern: ${activeId} (shares keys with ${patternId})`
        )
        this.activeMatches.delete(activeId)
      }
    }

    // Reset the rolling window to clear any lingering frames
    this.rollingWindow.reset()
    console.log(`[ShortcutFeature] Cleaned up all related matches for pattern: ${patternId}`)
  }

  private async executeAction(params: {
    action: ShortcutAction
    shortcutId: string
    stepNumber: number
  }): Promise<void> {
    const { action, shortcutId, stepNumber } = params

    console.log(`[ShortcutFeature] Executing progressive action:`, {
      shortcutId,
      stepNumber,
      action
    })

    try {
      if (action.type === 'launch') {
        console.log(`[ShortcutFeature] Would launch: ${action.program}`)
      } else if (action.type === 'command') {
        console.log(`[ShortcutFeature] Would run command: ${action.command}`)
      }

      this.emit('shortcut:step:executed', { shortcutId, stepNumber, action })
    } catch (error) {
      console.error('[ShortcutFeature] Error executing step action:', error)
      this.emit('shortcut:step:error', { error, shortcutId, stepNumber })
    }
  }

  dispose(): void {
    if (this.isInitialized) {
      keyboardService.off('keyboard:frame', this.handleFrameEvent)
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer)
        this.cleanupTimer = null
      }
      this.rollingWindow.reset()
      this.lastExecutions.clear()
      this.activeMatches.clear()
      this.isInitialized = false
      this.removeAllListeners()
    }
  }
}

// Export singleton instance
export const shortcutFeature = new ShortcutFeature()
