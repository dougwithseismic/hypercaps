import { KeyboardFrame } from '@hypercaps/keyboard-monitor'

export interface ErrorState {
  message: string
  timestamp: number
  code?: string
}

export interface KeyboardServiceState {
  isListening: boolean
  isLoading: boolean
  isStarting: boolean
  error?: string
  lastError?: ErrorState
}

export interface KeyboardFrameState {
  justPressed: string[]
  held: string[]
  justReleased: string[]
  holdDurations: Record<string, number>
  frameNumber: number
  timestamp: number
}

export interface KeyboardFrameEvent extends Omit<KeyboardFrame, 'state'> {
  id: string
  processed: boolean
  validationErrors?: string[]
  state: KeyboardFrameState
  frameTimestamp: number
  event: {
    type: 'keydown' | 'keyup'
    key: string
  }
}

export interface StateChangeEvent {
  previous: Partial<KeyboardServiceState>
  current: Partial<KeyboardServiceState>
  timestamp: number
}

export type KeyboardEventMap = {
  'keyboard:frame': KeyboardFrameEvent
  'keyboard:error': ErrorState
  'keyboard:state': StateChangeEvent
}
