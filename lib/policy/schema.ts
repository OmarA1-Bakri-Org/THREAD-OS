import { z } from 'zod'

export const PolicyModeSchema = z.enum(['SAFE', 'POWER'])
export type PolicyMode = z.infer<typeof PolicyModeSchema>

export const PolicyConfigSchema = z.object({
  mode: PolicyModeSchema.default('SAFE'),
  command_allowlist: z.array(z.string()).default([]),
  cwd_patterns: z.array(z.string()).default(['**']),
  max_fanout: z.number().default(10),
  max_concurrent: z.number().default(5),
  forbidden_patterns: z.array(z.string()).default([]),
})

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>

export interface PolicyAction {
  type: 'run_command' | 'fanout' | 'concurrent'
  command?: string
  cwd?: string
  fanout_count?: number
  concurrent_count?: number
}

export interface PolicyResult {
  allowed: boolean
  reason?: string
  confirmation_required: boolean
}
