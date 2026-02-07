import { describe, expect, test } from 'bun:test'
import { generateTemplate } from './index'
import type { TemplateOptions } from './index'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BASE_OPTIONS: TemplateOptions = {
  baseName: 'test-task',
  model: 'claude-code',
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('generateTemplate', () => {
  // ---- base -------------------------------------------------------

  test('base template returns 1 step and 0 gates', () => {
    const result = generateTemplate('base', BASE_OPTIONS)

    expect(result.steps).toHaveLength(1)
    expect(result.gates).toHaveLength(0)

    const step = result.steps[0]
    expect(step.id).toBe('test-task')
    expect(step.name).toBe('test-task')
    expect(step.type).toBe('base')
    expect(step.model).toBe('claude-code')
    expect(step.prompt_file).toBe('.threados/prompts/test-task.md')
    expect(step.depends_on).toEqual([])
    expect(step.status).toBe('READY')
  })

  // ---- parallel ---------------------------------------------------

  test('parallel template returns N worker steps with group_id', () => {
    const workerCount = 4
    const result = generateTemplate('parallel', { ...BASE_OPTIONS, workerCount })

    expect(result.steps).toHaveLength(workerCount)
    expect(result.gates).toHaveLength(0)

    // All steps share the same group_id
    const groupIds = new Set(result.steps.map(s => s.group_id))
    expect(groupIds.size).toBe(1)

    for (const step of result.steps) {
      expect(step.type).toBe('p')
      expect(step.group_id).toBeDefined()
      expect(step.group_id).not.toBe('')
      expect(step.fanout).toBe(workerCount)
      expect(step.fail_policy).toBe('fail_fast')
    }

    // Workers are named sequentially
    expect(result.steps[0].id).toBe('test-task-worker-1')
    expect(result.steps[3].id).toBe('test-task-worker-4')
  })

  // ---- chained ----------------------------------------------------

  test('chained template returns N steps and N-1 gates', () => {
    const N = 5
    const result = generateTemplate('chained', { ...BASE_OPTIONS, phaseCount: N })

    expect(result.steps).toHaveLength(N)
    expect(result.gates).toHaveLength(N - 1)

    // First step has no dependencies and is READY
    expect(result.steps[0].depends_on).toHaveLength(0)
    expect(result.steps[0].status).toBe('READY')
    expect(result.steps[0].type).toBe('c')

    // Subsequent steps depend on the preceding gate and are BLOCKED
    for (let i = 1; i < N; i++) {
      const step = result.steps[i]
      expect(step.depends_on).toHaveLength(1)
      expect(step.depends_on[0]).toBe(`test-task-gate-${i}`)
      expect(step.status).toBe('BLOCKED')
    }

    // Each gate depends on the preceding step
    for (let i = 0; i < N - 1; i++) {
      const gate = result.gates[i]
      expect(gate.id).toBe(`test-task-gate-${i + 1}`)
      expect(gate.depends_on).toContain(`test-task-phase-${i + 1}`)
      expect(gate.status).toBe('PENDING')
    }
  })

  // ---- fusion -----------------------------------------------------

  test('fusion template returns candidate steps + synth step', () => {
    const candidateModels = ['claude-code', 'codex', 'gemini'] as const
    const result = generateTemplate('fusion', {
      ...BASE_OPTIONS,
      candidateModels: [...candidateModels],
    })

    // 3 candidates + 1 synthesis step
    expect(result.steps).toHaveLength(4)
    expect(result.gates).toHaveLength(0)

    // Candidate steps
    const candidates = result.steps.filter(s => !s.fusion_synth)
    expect(candidates).toHaveLength(3)
    for (const c of candidates) {
      expect(c.type).toBe('f')
      expect(c.depends_on).toEqual([])
      expect(c.status).toBe('READY')
      // Each candidate knows the other candidates
      expect(c.fusion_candidates).toBeDefined()
      expect(c.fusion_candidates!.length).toBe(2)
      expect(c.fusion_candidates).not.toContain(c.id)
    }

    // Synthesis step depends on all candidates
    const synthStep = result.steps.find(s => s.fusion_synth === true)!
    expect(synthStep).toBeDefined()
    expect(synthStep.id).toBe('test-task-synth')
    expect(synthStep.type).toBe('f')
    expect(synthStep.depends_on).toHaveLength(3)
    expect(synthStep.fusion_candidates).toHaveLength(3)
    for (const model of candidateModels) {
      expect(synthStep.depends_on).toContain(`test-task-${model}`)
    }
  })

  // ---- orchestrated -----------------------------------------------

  test('orchestrated template returns orchestrator step', () => {
    const result = generateTemplate('orchestrated', BASE_OPTIONS)

    expect(result.steps).toHaveLength(1)
    expect(result.gates).toHaveLength(0)

    const step = result.steps[0]
    expect(step.id).toBe('test-task-orchestrator')
    expect(step.type).toBe('b')
    expect(step.orchestrator).toBe(true)
    expect(step.model).toBe('claude-code')
    expect(step.depends_on).toEqual([])
  })

  // ---- long-autonomy ----------------------------------------------

  test('long-autonomy template returns main step + watchdog', () => {
    const result = generateTemplate('long-autonomy', BASE_OPTIONS)

    expect(result.steps).toHaveLength(2)
    expect(result.gates).toHaveLength(0)

    const mainStep = result.steps.find(s => s.id === 'test-task-main')!
    expect(mainStep).toBeDefined()
    expect(mainStep.type).toBe('l')
    expect(mainStep.timeout_ms).toBeDefined()
    expect(mainStep.timeout_ms).toBeGreaterThan(0)
    expect(mainStep.depends_on).toEqual([])

    const watchdogStep = result.steps.find(s => s.id === 'test-task-watchdog')!
    expect(watchdogStep).toBeDefined()
    expect(watchdogStep.type).toBe('l')
    expect(watchdogStep.watchdog_for).toBe('test-task-main')
    expect(watchdogStep.depends_on).toEqual([])
  })

  test('long-autonomy template without watchdog returns 1 step', () => {
    const result = generateTemplate('long-autonomy', {
      ...BASE_OPTIONS,
      includeWatchdog: false,
    })

    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].id).toBe('test-task-main')
    expect(result.steps[0].type).toBe('l')
  })
})
