import { describe, test, expect } from 'bun:test'
import { generateBase } from './base'
import { generateParallel } from './parallel'
import { generateChained } from './chained'
import { generateFusion } from './fusion'
import { generateOrchestrated } from './orchestrated'
import { generateLongAutonomy } from './long-autonomy'
import { StepSchema, GateSchema } from '../sequence/schema'

function validateSteps(steps: unknown[]) {
  for (const step of steps) {
    const result = StepSchema.safeParse(step)
    expect(result.success).toBe(true)
  }
}

describe('generateBase', () => {
  test('generates correct number of steps', () => {
    const steps = generateBase({ count: 3 })
    expect(steps).toHaveLength(3)
    validateSteps(steps)
  })

  test('creates sequential dependencies', () => {
    const steps = generateBase({ count: 3, prefix: 'task' })
    expect(steps[0].depends_on).toEqual([])
    expect(steps[1].depends_on).toEqual(['task-1'])
    expect(steps[2].depends_on).toEqual(['task-2'])
  })

  test('uses defaults', () => {
    const steps = generateBase()
    expect(steps).toHaveLength(1)
    expect(steps[0].type).toBe('base')
    expect(steps[0].model).toBe('claude-code')
  })
})

describe('generateParallel', () => {
  test('generates parallel steps with shared group_id', () => {
    const steps = generateParallel({ count: 3 })
    expect(steps).toHaveLength(3)
    validateSteps(steps)
    const gid = steps[0].group_id
    expect(gid).toBeDefined()
    for (const s of steps) {
      expect(s.group_id).toBe(gid)
      expect(s.type).toBe('p')
      expect(s.depends_on).toEqual([])
    }
  })
})

describe('generateChained', () => {
  test('generates chained steps without gates', () => {
    const { steps, gates } = generateChained({ count: 3 })
    expect(steps).toHaveLength(3)
    expect(gates).toHaveLength(0)
    validateSteps(steps)
    expect(steps[0].type).toBe('c')
    expect(steps[1].depends_on).toEqual(['chain-1'])
  })

  test('generates chained steps with gates', () => {
    const { steps, gates } = generateChained({ count: 3, gates: true })
    expect(steps).toHaveLength(3)
    expect(gates).toHaveLength(2)
    for (const g of gates) {
      const result = GateSchema.safeParse(g)
      expect(result.success).toBe(true)
    }
    // step-2 depends on gate-1
    expect(steps[1].depends_on).toEqual(['chain-gate-1'])
  })
})

describe('generateFusion', () => {
  test('generates candidates + synth step', () => {
    const steps = generateFusion({ candidateCount: 3 })
    expect(steps).toHaveLength(4) // 3 candidates + 1 synth
    validateSteps(steps)
    const candidates = steps.filter(s => s.fusion_candidates)
    const synth = steps.filter(s => s.fusion_synth)
    expect(candidates).toHaveLength(3)
    expect(synth).toHaveLength(1)
    expect(synth[0].depends_on).toHaveLength(3)
    expect(synth[0].type).toBe('f')
  })
})

describe('generateOrchestrated', () => {
  test('generates orchestrator + workers', () => {
    const steps = generateOrchestrated({ workerCount: 2 })
    expect(steps).toHaveLength(3) // 1 orch + 2 workers
    validateSteps(steps)
    expect(steps[0].orchestrator).toBe('orch-orchestrator')
    expect(steps[1].depends_on).toEqual(['orch-orchestrator'])
    expect(steps[1].type).toBe('b')
  })
})

describe('generateLongAutonomy', () => {
  test('generates main + watchdog', () => {
    const steps = generateLongAutonomy({ timeoutMs: 60000 })
    expect(steps).toHaveLength(2)
    validateSteps(steps)
    const main = steps.find(s => s.id === 'long-main')!
    const watchdog = steps.find(s => s.id === 'long-watchdog')!
    expect(main.type).toBe('l')
    expect(main.timeout_ms).toBe(60000)
    expect(watchdog.watchdog_for).toBe('long-main')
  })
})
