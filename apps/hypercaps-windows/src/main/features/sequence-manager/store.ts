import { z } from 'zod'
import { createStore } from '../../service/store'

const sequenceManagerConfigSchema = z.object({
  isEnabled: z.boolean()
})

type SequenceManagerConfig = z.infer<typeof sequenceManagerConfigSchema>

interface SequenceManagerStoreEvents {
  'store:changed': { config: SequenceManagerConfig }
  'store:error': { error: Error }
  'store:reset': undefined
}

export const sequenceStore = createStore<SequenceManagerConfig, SequenceManagerStoreEvents>({
  name: 'sequence-manager',
  schema: sequenceManagerConfigSchema,
  defaultConfig: {
    isEnabled: true
  }
})

export const sequenceManager = {
  setEnabled(enabled: boolean) {
    sequenceStore.update({
      update: (config) => {
        config.isEnabled = enabled
      }
    })
  }
}

export type { SequenceManagerConfig }
