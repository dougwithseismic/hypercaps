import { vi } from 'vitest'

export const mockSequenceStore = {
  get: vi.fn(() => ({ isEnabled: true })),
  on: vi.fn(),
  update: vi.fn()
}

export const setupStoreMocks = () => {
  vi.mock('../../store', () => ({
    sequenceStore: mockSequenceStore
  }))
}

export const resetStoreMocks = () => {
  vi.mocked(mockSequenceStore.get).mockReturnValue({ isEnabled: true })
}
