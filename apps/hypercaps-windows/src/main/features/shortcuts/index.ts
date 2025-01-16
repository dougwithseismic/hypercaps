import { shortcutFeature } from './index'
import { exec } from 'child_process'
import { randomUUID } from 'crypto'
import { Features, store } from '../../infrastructure/store'
import { keyboardService } from '../../service/keyboard/keyboard-service'
import type { KeyboardFrameEvent } from '../../service/keyboard/types'
import { KeyboardEventMatcher } from './keyboard-event-matcher'
import type {
  Command,
  CommandMatch,
  KeyboardFrame,
  Shortcut,
  ShortcutManagerConfig,
  TriggerStep
} from './types'
import { EventEmitter } from 'events'

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
          strict: step.strict
        }
      })),
      window: shortcut.trigger.totalTimeWindow,
      totalTimeWindow: shortcut.trigger.totalTimeWindow,
      strict: false // Default to non-strict mode
    },
    cooldown: shortcut.cooldown || 500 // Default cooldown if not specified
  }
}

class ShortcutFeature extends EventEmitter {
  private shortcutFeature: Features['shortcuts']
  private matcher: KeyboardEventMatcher
  private lastExecutions: Map<string, number>
  private isInitialized = false

  constructor() {
    super()
    this.matcher = new KeyboardEventMatcher(32, 5000) // 32 frames, 5 seconds
    this.lastExecutions = new Map()
    this.shortcutFeature = store.getFeatureConfig('shortcuts')
  }

  async initialize(): Promise<void> {
    console.log('[ShortcutFeature] Initializing...')

    try {
      // Get current state
      // TODO: Implement store.getFeature
      console.log('TODO: implement store.getFeature')

      // Initialize feature in store if it doesn't exist
      // TODO: Implement store.update
      console.log('TODO: implement store.update')

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
      justPressed: new Set(event.state.justPressed),
      heldKeys: new Set(event.state.held),
      justReleased: new Set(event.state.justReleased),
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
    // TODO: Implement store.getFeature
    console.log('TODO: implement store.getFeature')

    const shortcutsConfig = store.getFeatureConfig('shortcuts')
    console.log('shortcutsConfig', shortcutsConfig)

    const state = { isEnabled: true, shortcuts: [] } // Temporary mock state
    if (!state?.isEnabled) return

    const enabledShortcuts = state.shortcuts
      .filter((s: Shortcut) => s.enabled)
      .map(shortcutToCommand)

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

    console.log(`[ShortcutFeature] Executing shortcut: ${match.command.id}`)
    this.lastExecutions.set(match.command.id, now)

    try {
      // Find the original shortcut from the store
      // TODO: Implement store.getFeature
      console.log('TODO: implement store.getFeature')
      const state = { shortcuts: [] } // Temporary mock state
      const shortcut = state.shortcuts.find((s: Shortcut) => s.id === match.command.id)

      if (!shortcut) {
        console.error(`[ShortcutFeature] Shortcut not found: ${match.command.id}`)
        return
      }

      const isProduction = process.env.NODE_ENV === 'production'
      const { spawn } = require('child_process')

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
      }

      // Emit shortcut executed event
      this.emit('shortcut:executed', { shortcut, match })

      // Clear the matcher state after successful execution
      this.matcher.clearFramesUpTo(match.endTime)
    } catch (error) {
      console.error('[ShortcutFeature] Error executing shortcut:', error)
      this.emit('shortcut:error', { error, shortcutId: match.command.id })
    }
  }

  async addShortcut(shortcut: Omit<Shortcut, 'id'>): Promise<void> {
    const newShortcut: Shortcut = {
      ...shortcut,
      id: randomUUID()
    }

    // TODO: Implement store.update
    console.log('TODO: implement store.update', newShortcut)
    this.emit('shortcut:added', newShortcut)
  }

  async removeShortcut(id: string): Promise<void> {
    // TODO: Implement store.update
    console.log('TODO: implement store.update', id)
    this.emit('shortcut:removed', id)
  }

  async updateShortcut(id: string, update: Partial<Shortcut>): Promise<void> {
    // TODO: Implement store.update
    console.log('TODO: implement store.update', id, update)
    this.emit('shortcut:updated', { id, update })
  }

  async toggleEnabled(): Promise<void> {
    // TODO: Implement store.update
    console.log('TODO: implement store.update')
    this.emit('feature:toggled')
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

export const shortcutFeature = new ShortcutFeature()
