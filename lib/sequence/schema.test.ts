import { describe, expect, test } from 'bun:test'
import {
  StepSchema,
  GateSchema,
  SequenceSchema,
  SequencePolicySchema,
  StepStatusSchema,
  StepTypeSchema,
  ModelTypeSchema,
  FailPolicySchema,
  PolicyModeSchema,
} from './schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    name: 'My Step',
    type: 'base',
    model: 'claude-code',
    prompt_file: 'prompts/step1.md',
    ...overrides,
  }
}

function validGate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gate-1',
    name: 'Quality Gate',
    depends_on: ['step-1'],
    ...overrides,
  }
}

// ===========================================================================
// StepSchema
// ===========================================================================

describe('StepSchema', () => {
  // ---- valid inputs -------------------------------------------------------

  test('valid step with all required fields', () => {
    const result = StepSchema.safeParse(validStep())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('step-1')
      expect(result.data.name).toBe('My Step')
      expect(result.data.type).toBe('base')
      expect(result.data.model).toBe('claude-code')
      expect(result.data.prompt_file).toBe('prompts/step1.md')
    }
  })

  test('applies default values for status and depends_on', () => {
    const result = StepSchema.safeParse(validStep())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('READY')
      expect(result.data.depends_on).toEqual([])
    }
  })

  test('accepts explicit depends_on array', () => {
    const result = StepSchema.safeParse(validStep({ depends_on: ['a', 'b'] }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.depends_on).toEqual(['a', 'b'])
    }
  })

  test('accepts all valid StepType values', () => {
    const types = ['base', 'p', 'c', 'f', 'b', 'l'] as const
    for (const t of types) {
      const result = StepSchema.safeParse(validStep({ type: t }))
      expect(result.success).toBe(true)
    }
  })

  test('accepts all valid ModelType values', () => {
    const models = ['claude-code', 'codex', 'gemini'] as const
    for (const m of models) {
      const result = StepSchema.safeParse(validStep({ model: m }))
      expect(result.success).toBe(true)
    }
  })

  test('accepts all valid StepStatus values', () => {
    const statuses = ['READY', 'RUNNING', 'NEEDS_REVIEW', 'DONE', 'FAILED', 'BLOCKED'] as const
    for (const s of statuses) {
      const result = StepSchema.safeParse(validStep({ status: s }))
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe(s)
      }
    }
  })

  // ---- optional fields ----------------------------------------------------

  test('accepts optional P-thread fields (group_id, fanout, fail_policy)', () => {
    const result = StepSchema.safeParse(
      validStep({
        type: 'p',
        group_id: 'grp-1',
        fanout: 4,
        fail_policy: 'fail_fast',
      })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.group_id).toBe('grp-1')
      expect(result.data.fanout).toBe(4)
      expect(result.data.fail_policy).toBe('fail_fast')
    }
  })

  test('accepts optional F-thread fields (fusion_candidates, fusion_synth)', () => {
    const result = StepSchema.safeParse(
      validStep({
        type: 'f',
        fusion_candidates: ['a', 'b'],
        fusion_synth: true,
      })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fusion_candidates).toEqual(['a', 'b'])
      expect(result.data.fusion_synth).toBe(true)
    }
  })

  test('accepts optional B-thread field (orchestrator)', () => {
    const result = StepSchema.safeParse(validStep({ type: 'b', orchestrator: true }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.orchestrator).toBe(true)
    }
  })

  test('accepts optional L-thread field (watchdog_for)', () => {
    const result = StepSchema.safeParse(validStep({ type: 'l', watchdog_for: 'step-2' }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.watchdog_for).toBe('step-2')
    }
  })

  test('accepts optional timeout_ms (>= 1000)', () => {
    const result = StepSchema.safeParse(validStep({ timeout_ms: 5000 }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timeout_ms).toBe(5000)
    }
  })

  test('accepts optional lane, role, cwd, artifacts', () => {
    const result = StepSchema.safeParse(
      validStep({ lane: 'backend', role: 'dev', cwd: './src', artifacts: ['dist/out.js'] })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lane).toBe('backend')
      expect(result.data.role).toBe('dev')
      expect(result.data.cwd).toBe('./src')
      expect(result.data.artifacts).toEqual(['dist/out.js'])
    }
  })

  // ---- invalid inputs -----------------------------------------------------

  test('rejects step ID with uppercase letters', () => {
    const result = StepSchema.safeParse(validStep({ id: 'Step-1' }))
    expect(result.success).toBe(false)
  })

  test('rejects step ID with special characters', () => {
    for (const bad of ['step_1', 'step.1', 'step@1', 'step 1', 'step/1']) {
      const result = StepSchema.safeParse(validStep({ id: bad }))
      expect(result.success).toBe(false)
    }
  })

  test('rejects empty step ID', () => {
    const result = StepSchema.safeParse(validStep({ id: '' }))
    expect(result.success).toBe(false)
  })

  test('rejects step ID exceeding 64 characters', () => {
    const result = StepSchema.safeParse(validStep({ id: 'a'.repeat(65) }))
    expect(result.success).toBe(false)
  })

  test('rejects empty step name', () => {
    const result = StepSchema.safeParse(validStep({ name: '' }))
    expect(result.success).toBe(false)
  })

  test('rejects missing required fields', () => {
    const requiredKeys = ['id', 'name', 'type', 'model', 'prompt_file']
    for (const key of requiredKeys) {
      const step = validStep()
      delete (step as Record<string, unknown>)[key]
      const result = StepSchema.safeParse(step)
      expect(result.success).toBe(false)
    }
  })

  test('rejects invalid type enum', () => {
    const result = StepSchema.safeParse(validStep({ type: 'unknown' }))
    expect(result.success).toBe(false)
  })

  test('rejects invalid model enum', () => {
    const result = StepSchema.safeParse(validStep({ model: 'gpt-4' }))
    expect(result.success).toBe(false)
  })

  test('rejects invalid status enum', () => {
    const result = StepSchema.safeParse(validStep({ status: 'CANCELLED' }))
    expect(result.success).toBe(false)
  })

  test('rejects empty prompt_file', () => {
    const result = StepSchema.safeParse(validStep({ prompt_file: '' }))
    expect(result.success).toBe(false)
  })

  test('rejects fanout less than 1', () => {
    const result = StepSchema.safeParse(validStep({ fanout: 0 }))
    expect(result.success).toBe(false)
  })

  test('rejects timeout_ms less than 1000', () => {
    const result = StepSchema.safeParse(validStep({ timeout_ms: 999 }))
    expect(result.success).toBe(false)
  })

  test('rejects invalid fail_policy enum', () => {
    const result = StepSchema.safeParse(validStep({ fail_policy: 'retry' }))
    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// Enum schemas (standalone)
// ===========================================================================

describe('StepStatusSchema', () => {
  test('accepts all valid values', () => {
    for (const v of ['READY', 'RUNNING', 'NEEDS_REVIEW', 'DONE', 'FAILED', 'BLOCKED']) {
      expect(StepStatusSchema.safeParse(v).success).toBe(true)
    }
  })

  test('rejects invalid value', () => {
    expect(StepStatusSchema.safeParse('PAUSED').success).toBe(false)
  })
})

describe('StepTypeSchema', () => {
  test('accepts all valid values', () => {
    for (const v of ['base', 'p', 'c', 'f', 'b', 'l']) {
      expect(StepTypeSchema.safeParse(v).success).toBe(true)
    }
  })

  test('rejects invalid value', () => {
    expect(StepTypeSchema.safeParse('x').success).toBe(false)
  })
})

describe('ModelTypeSchema', () => {
  test('accepts all valid values', () => {
    for (const v of ['claude-code', 'codex', 'gemini']) {
      expect(ModelTypeSchema.safeParse(v).success).toBe(true)
    }
  })

  test('rejects invalid value', () => {
    expect(ModelTypeSchema.safeParse('gpt-4').success).toBe(false)
  })
})

describe('FailPolicySchema', () => {
  test('accepts fail_fast and best_effort', () => {
    expect(FailPolicySchema.safeParse('fail_fast').success).toBe(true)
    expect(FailPolicySchema.safeParse('best_effort').success).toBe(true)
  })

  test('rejects invalid value', () => {
    expect(FailPolicySchema.safeParse('retry').success).toBe(false)
  })
})

describe('PolicyModeSchema', () => {
  test('accepts SAFE and POWER', () => {
    expect(PolicyModeSchema.safeParse('SAFE').success).toBe(true)
    expect(PolicyModeSchema.safeParse('POWER').success).toBe(true)
  })

  test('rejects invalid value', () => {
    expect(PolicyModeSchema.safeParse('DEBUG').success).toBe(false)
  })
})

// ===========================================================================
// GateSchema
// ===========================================================================

describe('GateSchema', () => {
  test('valid gate with all required fields', () => {
    const result = GateSchema.safeParse(validGate())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('gate-1')
      expect(result.data.name).toBe('Quality Gate')
      expect(result.data.depends_on).toEqual(['step-1'])
    }
  })

  test('applies default status PENDING', () => {
    const result = GateSchema.safeParse(validGate())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('PENDING')
    }
  })

  test('accepts all GateStatus values', () => {
    for (const s of ['PENDING', 'APPROVED', 'BLOCKED'] as const) {
      const result = GateSchema.safeParse(validGate({ status: s }))
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.status).toBe(s)
    }
  })

  test('rejects gate ID with uppercase', () => {
    const result = GateSchema.safeParse(validGate({ id: 'Gate-1' }))
    expect(result.success).toBe(false)
  })

  test('rejects gate ID with special characters', () => {
    const result = GateSchema.safeParse(validGate({ id: 'gate_1' }))
    expect(result.success).toBe(false)
  })

  test('rejects empty gate name', () => {
    const result = GateSchema.safeParse(validGate({ name: '' }))
    expect(result.success).toBe(false)
  })

  test('rejects missing depends_on', () => {
    const g = { id: 'gate-1', name: 'G' }
    const result = GateSchema.safeParse(g)
    expect(result.success).toBe(false)
  })

  test('rejects invalid gate status', () => {
    const result = GateSchema.safeParse(validGate({ status: 'OPEN' }))
    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// SequenceSchema
// ===========================================================================

describe('SequenceSchema', () => {
  test('valid minimal sequence', () => {
    const result = SequenceSchema.safeParse({ name: 'test-seq' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('test-seq')
      expect(result.data.version).toBe('1.0')
      expect(result.data.steps).toEqual([])
      expect(result.data.gates).toEqual([])
    }
  })

  test('valid sequence with steps and gates', () => {
    const seq = {
      name: 'full-seq',
      steps: [validStep()],
      gates: [validGate()],
    }
    const result = SequenceSchema.safeParse(seq)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.steps).toHaveLength(1)
      expect(result.data.gates).toHaveLength(1)
    }
  })

  test('rejects missing name', () => {
    const result = SequenceSchema.safeParse({ steps: [] })
    expect(result.success).toBe(false)
  })

  test('rejects empty name', () => {
    const result = SequenceSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  test('applies default version 1.0', () => {
    const result = SequenceSchema.safeParse({ name: 'x' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.version).toBe('1.0')
  })

  test('accepts metadata fields', () => {
    const result = SequenceSchema.safeParse({
      name: 'x',
      metadata: {
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        created_by: 'alice',
        description: 'A test sequence',
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts policy object', () => {
    const result = SequenceSchema.safeParse({
      name: 'x',
      policy: { mode: 'POWER', max_fanout: 5 },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.policy!.mode).toBe('POWER')
      expect(result.data.policy!.max_fanout).toBe(5)
    }
  })

  test('propagates step validation errors', () => {
    const result = SequenceSchema.safeParse({
      name: 'x',
      steps: [{ id: 'BAD' }],
    })
    expect(result.success).toBe(false)
  })

  test('propagates gate validation errors', () => {
    const result = SequenceSchema.safeParse({
      name: 'x',
      gates: [{ id: 'BAD' }],
    })
    expect(result.success).toBe(false)
  })
})

// ===========================================================================
// SequencePolicySchema defaults
// ===========================================================================

describe('SequencePolicySchema', () => {
  test('applies all defaults when parsing empty object', () => {
    const result = SequencePolicySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mode).toBe('SAFE')
      expect(result.data.max_fanout).toBe(10)
      expect(result.data.max_concurrent).toBe(20)
      expect(result.data.timeout_default_ms).toBe(1800000)
    }
  })

  test('rejects max_fanout less than 1', () => {
    const result = SequencePolicySchema.safeParse({ max_fanout: 0 })
    expect(result.success).toBe(false)
  })

  test('rejects max_concurrent less than 1', () => {
    const result = SequencePolicySchema.safeParse({ max_concurrent: 0 })
    expect(result.success).toBe(false)
  })

  test('rejects timeout_default_ms less than 1000', () => {
    const result = SequencePolicySchema.safeParse({ timeout_default_ms: 500 })
    expect(result.success).toBe(false)
  })
})
