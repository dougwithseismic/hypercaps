import { exec } from 'child_process'
import { EventEmitter } from 'events'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import { KeyboardEventMatcher } from './keyboard-event-matcher'
import { shortcutStore } from './store'
import type {
  Command,
  CommandMatch,
  KeyboardFrame,
  Shortcut,
  ShortcutManagerConfig,
  TriggerStep
} from './types'
import { spawn } from 'child_process'

// Helper function to convert Shortcut to Command
function shortcutToCommand(shortcut: Shortcut): Command {
  return {
    id: shortcut.id,
    pattern: {
      steps: shortcut.trigger.steps.map((step) => ({
        type: step.type as TriggerStep['type'],
        keys: step.keys,
        conditions: {
          holdTime: step.holdTime,
          window: step.window,
          strict: step.type === 'combo' ? (step.strict ?? true) : step.strict // Default to strict for combos
        }
      })),
      window: shortcut.trigger.totalTimeWindow,
      totalTimeWindow: shortcut.trigger.totalTimeWindow,
      strict: shortcut.trigger.strict ?? false // Global strict mode setting
    },
    cooldown: shortcut.cooldown || 500 // Default cooldown if not specified
  }
}

class ShortcutFeature extends EventEmitter {
  private matcher: KeyboardEventMatcher
  private lastExecutions: Map<string, number>
  private isInitialized = false
  private isEnabled: boolean
  private config: ShortcutManagerConfig
  private store = shortcutStore

  constructor() {
    super()
    this.matcher = new KeyboardEventMatcher({
      maxFrames: 32, // 32 frames buffer
      maxAgeMs: 5000 // 5 seconds max age
    })
    this.lastExecutions = new Map()
    this.config = this.store.get()
    this.isEnabled = this.config.isEnabled
  }

  async initialize(): Promise<void> {
    console.log('[ShortcutFeature] Initializing...')

    try {
      // Subscribe to store changes
      this.store.subscribe((config) => {
        console.log('[ShortcutFeature] Config updated:', config)
        this.config = config
        this.isEnabled = config.isEnabled
      })

      // Subscribe to keyboard frames
      keyboardService.on('keyboard:frame', this.handleFrameEvent)

      this.isInitialized = true
      console.log('[ShortcutFeature] Initialized successfully')
    } catch (error) {
      console.error('[ShortcutFeature] Initialization error:', error)
    }
  }

  private handleFrameEvent = (event: KeyboardFrameEvent): void => {
    const frame: KeyboardFrame = {
      id: event.id,
      timestamp: event.timestamp,
      justPressed: new Set(event.state.justPressed.map(String)),
      heldKeys: new Set(event.state.held.map(String)),
      justReleased: new Set(event.state.justReleased.map(String)),
      holdDurations: new Map(Object.entries(event.state.holdDurations))
    }

    // Add frame to matcher
    this.matcher.addFrame(frame)

    // Find and execute matches
    this.findAndExecuteMatches().catch((error) => {
      console.error('[ShortcutFeature] Error executing matches:', error)
    })
  }

  private async findAndExecuteMatches(): Promise<void> {
    if (!this.isEnabled || !this.config.isEnabled) return

    const enabledShortcuts = this.config.shortcuts.filter((s) => s.enabled).map(shortcutToCommand)

    const matches = this.matcher.findMatches(enabledShortcuts)
    // Execute matched shortcuts
    for (const match of matches) {
      await this.executeShortcut(match)
    }
  }

  private async executeShortcut(match: CommandMatch): Promise<void> {
    const now = Date.now()
    const lastExecution = this.lastExecutions.get(match.command.id) || 0
    const cooldown = match.command.cooldown || 500

    if (now - lastExecution < cooldown) {
      console.log(
        `[ShortcutFeature] Skipping execution of ${match.command.id} - in cooldown (${cooldown}ms)`
      )
      return
    }

    try {
      // Find the shortcut from local config
      const shortcut = this.config.shortcuts.find((s) => s.id === match.command.id)

      if (!shortcut) {
        console.error(`[ShortcutFeature] Shortcut not found: ${match.command.id}`)
        return
      }

      const isProduction = process.env.NODE_ENV === 'production'

      if (shortcut.action.type === 'launch') {
        console.log(`[ShortcutFeature] Launching program: ${shortcut.action.program}`)
        const program = shortcut.action.program || ''

        if (isProduction) {
          const child = spawn('cmd.exe', ['/c', 'start', '', program], {
            shell: true,
            detached: true,
            stdio: 'ignore'
          })

          child.on('error', (error: Error) => {
            console.error(`[ShortcutFeature] Launch error: ${error.message}`)
          })

          child.unref()
        } else {
          exec(program, (error) => {
            if (error) {
              console.error(`[ShortcutFeature] Error executing program: ${error}`)
            }
          })
        }
      } else if (shortcut.action.type === 'command') {
        console.log(`[ShortcutFeature] Running command: ${shortcut.action.command}`)
        const command = shortcut.action.command || ''
        console.log('[ShortcutFeature] Running command (Need to implement):', command)
        // TODO: Implement command execution
      }

      // Emit shortcut executed event
      this.emit('shortcut:executed', { shortcut, match })

      // Clear the matcher state after successful execution
      this.matcher.clearFramesUpTo(match.endTime)
    } catch (error) {
      console.error('[ShortcutFeature] Error executing shortcut:', error)
      this.emit('shortcut:error', { error, shortcutId: match.command.id })
    } finally {
      console.log(`[ShortcutFeature] Executing shortcut: ${match.command.id}`)
      this.lastExecutions.set(match.command.id, now)
    }
  }

  dispose(): void {
    if (this.isInitialized) {
      keyboardService.off('keyboard:frame', this.handleFrameEvent)
      this.matcher.reset()
      this.lastExecutions.clear()
      this.isInitialized = false
      this.removeAllListeners()
    }
  }
}

// Export singleton instance
export const shortcutFeature = new ShortcutFeature()
