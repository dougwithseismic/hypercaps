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
  frameHistory: KeyboardFrameEvent[]
  currentFrame?: KeyboardFrameEvent
  error?: string
  lastError?: ErrorState
}

export interface KeyboardFrameState {
  justPressed: number[]
  held: number[]
  justReleased: number[]
  holdDurations: Record<number, number>
}

export interface KeyboardFrameEvent extends Omit<KeyboardFrame, 'state'> {
  id: string
  processed: boolean
  validationErrors?: string[]
  state: KeyboardFrameState
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
  'keyboard:frameHistory': KeyboardFrameEvent[]
}
