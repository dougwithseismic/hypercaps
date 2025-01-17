import { EventEmitter } from 'events'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import { RollingWindow } from './rolling-window'
import { shortcutStore } from './store'
import { PatternFactory } from './pattern-factory'
import { PatternMatcher } from './pattern-matcher'
import type {
  KeyboardFrame,
  Shortcut,
  ShortcutManagerConfig,
  TriggerStep,
  ShortcutAction
} from './types'
import type { PatternNode } from './types/patterns'

class ShortcutFeature extends EventEmitter {
  private rollingWindow: RollingWindow
  private isInitialized = false
  private store = shortcutStore
  private patternFactory = new PatternFactory()
  private patternMatcher = new PatternMatcher()
  private holdPatterns = new Map<string, PatternNode>()
  private comboPatterns = new Map<string, PatternNode>()
  private isEnabled = true
  private lastExecutions = new Map<string, number>()
  private readonly COOLDOWN_DEFAULT = 500

  constructor() {
    super()
    this.rollingWindow = new RollingWindow({
      maxFrames: 32,
      maxAgeMs: 5000
    })
  }

  async initialize(): Promise<void> {
    console.log('[ShortcutFeature] Initializing...')

    try {
      // Initialize patterns from config
      const config = this.store.get()
      this.isEnabled = config.isEnabled
      this.updatePatterns(config.shortcuts)

      // Subscribe to store changes
      this.store.subscribe((newConfig) => {
        console.log('[ShortcutFeature] Config updated')
        this.isEnabled = newConfig.isEnabled
        this.updatePatterns(newConfig.shortcuts)
      })

      // Subscribe to keyboard frames
      keyboardService.on('keyboard:frame', this.handleFrameEvent)

      this.isInitialized = true
      console.log('[ShortcutFeature] Initialized successfully')
    } catch (error) {
      console.error('[ShortcutFeature] Initialization error:', error)
    }
  }

  private updatePatterns(shortcuts: Shortcut[]): void {
    const patterns = this.patternFactory.createFromConfig(shortcuts.filter((s) => s.enabled))
    this.holdPatterns = patterns.holdPatterns
    this.comboPatterns = patterns.comboPatterns

    console.log('[ShortcutFeature] Updated patterns:', {
      holdPatterns: this.holdPatterns.size,
      comboPatterns: this.comboPatterns.size
    })
  }

  private handleFrameEvent = (event: KeyboardFrameEvent): void => {
    if (!this.isEnabled) return

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

    // Process frame for matches
    const matches = this.patternMatcher.processFrame(frame, this.holdPatterns, this.comboPatterns)

    // Execute matches that aren't in cooldown
    for (const match of matches) {
      const lastExecution = this.lastExecutions.get(match.pattern.id) || 0
      const cooldown = this.COOLDOWN_DEFAULT

      if (frame.timestamp - lastExecution >= cooldown) {
        void this.executePattern(match)
        this.lastExecutions.set(match.pattern.id, frame.timestamp)
      }
    }
  }

  private async executePattern(match: {
    pattern: { id: string; action: ShortcutAction }
    endTime: number
  }): Promise<void> {
    try {
      console.log(`[ShortcutFeature] Executing pattern: ${match.pattern.id}`)
      console.log(`[ShortcutFeature] Action type: ${match.pattern.action.type}`)

      if (match.pattern.action.type === 'launch') {
        console.log(`[ShortcutFeature] Would launch: ${match.pattern.action.program}`)
      } else if (match.pattern.action.type === 'command') {
        console.log(`[ShortcutFeature] Would run command: ${match.pattern.action.command}`)
      }

      this.emit('shortcut:executed', { shortcutId: match.pattern.id, timestamp: match.endTime })
    } catch (error) {
      console.error('[ShortcutFeature] Error executing pattern:', error)
      this.emit('shortcut:error', { error, shortcutId: match.pattern.id })
    }
  }

  dispose(): void {
    if (this.isInitialized) {
      keyboardService.off('keyboard:frame', this.handleFrameEvent)
      this.rollingWindow.reset()
      this.patternMatcher.reset()
      this.isInitialized = false
      this.removeAllListeners()
    }
  }
}

// Export singleton instance
export const shortcutFeature = new ShortcutFeature()
