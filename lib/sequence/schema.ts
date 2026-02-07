import { z } from 'zod'

// Schema naming convention: use Schema suffix to avoid name collision with types

export const StepStatusSchema = z.enum([
  'READY', 'RUNNING', 'NEEDS_REVIEW', 'DONE', 'FAILED', 'BLOCKED'
])
export type StepStatus = z.infer<typeof StepStatusSchema>

export const StepTypeSchema = z.enum(['base', 'p', 'c', 'f', 'b', 'l'])
export type StepType = z.infer<typeof StepTypeSchema>

export const ModelTypeSchema = z.enum(['claude-code', 'codex', 'gemini'])
export type ModelType = z.infer<typeof ModelTypeSchema>

export const FailPolicySchema = z.enum(['fail_fast', 'best_effort'])
export type FailPolicy = z.infer<typeof FailPolicySchema>

export const PolicyModeSchema = z.enum(['SAFE', 'POWER'])
export type PolicyMode = z.infer<typeof PolicyModeSchema>

export const StepSchema = z.object({
  id: z.string()
    .regex(/^[a-z0-9-]+$/, { message: 'Step ID must contain only lowercase letters, numbers, and hyphens' })
    .min(1, { message: 'Step ID cannot be empty' })
    .max(64, { message: 'Step ID cannot exceed 64 characters' }),
  name: z.string().min(1, { message: 'Step name is required' }),
  type: StepTypeSchema,
  lane: z.string().optional(),
  role: z.string().optional(),
  cwd: z.string().optional(),
  model: ModelTypeSchema,
  prompt_file: z.string().min(1, { message: 'Prompt file path is required' }),
  depends_on: z.array(z.string()).default([]),
  status: StepStatusSchema.default('READY'),
  artifacts: z.array(z.string()).optional(),
  // P-thread fields
  group_id: z.string().optional(),
  fanout: z.number().min(1).optional(),
  fail_policy: FailPolicySchema.optional(),
  // F-thread fields
  fusion_candidates: z.array(z.string()).optional(),
  fusion_synth: z.boolean().optional(),
  // B-thread fields
  orchestrator: z.boolean().optional(),
  // L-thread fields
  watchdog_for: z.string().optional(),
  // Per-step timeout override (ms)
  timeout_ms: z.number().min(1000).optional(),
})

export const GateStatusSchema = z.enum(['PENDING', 'APPROVED', 'BLOCKED'])
export type GateStatus = z.infer<typeof GateStatusSchema>

export const GateSchema = z.object({
  id: z.string()
    .regex(/^[a-z0-9-]+$/, { message: 'Gate ID must contain only lowercase letters, numbers, and hyphens' })
    .min(1, { message: 'Gate ID cannot be empty' }),
  name: z.string().min(1, { message: 'Gate name is required' }),
  depends_on: z.array(z.string()),
  status: GateStatusSchema.default('PENDING'),
})

export const SequenceMetadataSchema = z.object({
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  description: z.string().optional(),
})

export const SequencePolicySchema = z.object({
  mode: PolicyModeSchema.default('SAFE'),
  max_fanout: z.number().min(1).default(10),
  max_concurrent: z.number().min(1).default(20),
  timeout_default_ms: z.number().min(1000).default(1800000),
  allowed_commands: z.array(z.string()).optional(),
  allowed_cwd: z.array(z.string()).optional(),
  forbidden_patterns: z.array(z.string()).optional(),
  confirmation_required: z.array(z.string()).optional(),
})

export const SequenceSchema = z.object({
  version: z.string().default('1.0'),
  name: z.string().min(1, { message: 'Sequence name is required' }),
  steps: z.array(StepSchema).default([]),
  gates: z.array(GateSchema).default([]),
  metadata: SequenceMetadataSchema.optional(),
  policy: SequencePolicySchema.optional(),
})

// Clean type exports (no collision with schema names)
export type Step = z.infer<typeof StepSchema>
export type Gate = z.infer<typeof GateSchema>
export type Sequence = z.infer<typeof SequenceSchema>
export type SequenceMetadata = z.infer<typeof SequenceMetadataSchema>
export type SequencePolicy = z.infer<typeof SequencePolicySchema>
