import { CapsLockBehaviorOptions } from '@hypercaps/keyboard-monitor'
import { z } from 'zod'

const remapperBehaviorSchema = z.enum(CapsLockBehaviorOptions)

export const remapperConfigSchema = z.object({
  isRemapperEnabled: z.boolean(),
  capsLockBehavior: remapperBehaviorSchema,
  remaps: z.record(z.array(z.string()))
})

export type RemapperConfig = z.infer<typeof remapperConfigSchema>

export type RemapperRemap = RemapperConfig['remaps']

export interface RemapperFeature {
  isFeatureEnabled: boolean
  config: RemapperConfig
}
