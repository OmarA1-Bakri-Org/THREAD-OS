import { z } from 'zod'
import { PolicyModeSchema } from '../sequence/schema'

export const PolicyFileSchema = z.object({
  mode: PolicyModeSchema.default('SAFE'),
  max_fanout: z.number().min(1).default(10),
  max_concurrent: z.number().min(1).default(20),
  timeout_default_ms: z.number().min(1000).default(1800000),
  allowed_commands: z.array(z.string()).default([
    'claude', 'codex', 'gemini', 'bun', 'npm', 'npx', 'node', 'git', 'tsc'
  ]),
  allowed_cwd: z.array(z.string()).default(['./**']),
  forbidden_patterns: z.array(z.string()).default([
    'rm\\s+-rf\\s+/',
    'sudo',
    'format\\s+[A-Z]:'
  ]),
  confirmation_required: z.array(z.string()).default([
    'step.rm',
    'gate.block',
    'run.all'
  ]),
})

export type PolicyFile = z.infer<typeof PolicyFileSchema>
