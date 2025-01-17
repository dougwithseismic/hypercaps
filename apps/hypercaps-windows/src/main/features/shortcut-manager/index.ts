import { EventEmitter } from 'events'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import { RollingWindow } from './rolling-window'
import { shortcutStore } from './store'
import type {
  Command,
  CommandMatch,
  KeyboardFrame,
  Shortcut,
  ShortcutManagerConfig,
  TriggerStep
} from './types'

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
  private rollingWindow: RollingWindow
  private lastExecutions: Map<string, number>
  private isInitialized = false
  private isEnabled: boolean
  private config: ShortcutManagerConfig
  private store = shortcutStore
  private enabledShortcuts: Command[] = []

  constructor() {
    super()
    this.rollingWindow = new RollingWindow({
      maxFrames: 32, // 32 frames buffer
      maxAgeMs: 5000 // 5 seconds max age
    })
    this.lastExecutions = new Map()
    this.config = this.store.get()
    this.isEnabled = this.config.isEnabled
    this.enabledShortcuts = this.config.shortcuts.filter((s) => s.enabled).map(shortcutToCommand)
  }

  async initialize(): Promise<void> {
    console.log('[ShortcutFeature] Initializing...')

    try {
      // Subscribe to store changes
      this.store.subscribe((config) => {
        console.log('[ShortcutFeature] Config updated:', config)
        this.config = config
        this.isEnabled = config.isEnabled
        this.enabledShortcuts = this.config.shortcuts
          .filter((s) => s.enabled)
          .map(shortcutToCommand)
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

  private async findAndExecuteMatches(): Promise<void> {
    if (!this.isEnabled || !this.config.isEnabled) return
    const frames = this.rollingWindow.getFrames()
    console.log('Frames', frames)
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

      console.log(`
      ███████╗██╗  ██╗ ██████╗ ██████╗ ████████╗ ██████╗██╗   ██╗████████╗██╗
      ██╔════╝██║  ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██║   ██║╚══██╔══╝██║
      ███████╗███████║██║   ██║██████╔╝   ██║   ██║     ██║   ██║   ██║   ██║
      ╚════██║██╔══██║██║   ██║██╔══██╗   ██║   ██║     ██║   ██║   ██║   ╚═╝
      ███████║██║  ██║╚██████╔╝██║  ██║   ██║   ╚██████╗╚██████╔╝   ██║   ██╗
      ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝   ╚═╝
      `)
      console.log(
        `[ShortcutFeature] Would execute shortcut: ${shortcut.name} (${match.command.id})`
      )
      console.log(`[ShortcutFeature] Action type: ${shortcut.action.type}`)
      if (shortcut.action.type === 'launch') {
        console.log(`[ShortcutFeature] Would launch: ${shortcut.action.program}`)
      } else if (shortcut.action.type === 'command') {
        console.log(`[ShortcutFeature] Would run command: ${shortcut.action.command}`)
      }

      // Emit shortcut executed event
      this.emit('shortcut:executed', { shortcut, match })

      // Clear the matcher state after successful execution
    } catch (error) {
      console.error('[ShortcutFeature] Error executing shortcut:', error)
      this.emit('shortcut:error', { error, shortcutId: match.command.id })
    } finally {
      this.lastExecutions.set(match.command.id, now)
    }
  }

  dispose(): void {
    if (this.isInitialized) {
      keyboardService.off('keyboard:frame', this.handleFrameEvent)
      this.rollingWindow.reset()
      this.lastExecutions.clear()
      this.isInitialized = false
      this.removeAllListeners()
    }
  }
}

// Export singleton instance
export const shortcutFeature = new ShortcutFeature()
