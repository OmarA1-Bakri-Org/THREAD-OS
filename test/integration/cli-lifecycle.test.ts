import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test'
import { mkdtemp, rm, mkdir, access, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { readSequence, writeSequence } from '../../lib/sequence/parser'
import { validateDAG, topologicalSort } from '../../lib/sequence/dag'
import { depCommand } from '../../lib/seqctl/commands/dep'
import { gateCommand } from '../../lib/seqctl/commands/gate'
import { groupCommand } from '../../lib/seqctl/commands/group'
import { statusCommand } from '../../lib/seqctl/commands/status'
import type { Sequence } from '../../lib/sequence/schema'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const JSON_OPTS = { json: true, help: false, watch: false } as const

function lastJsonOutput(spy: ReturnType<typeof spyOn>): Record<string, unknown> {
  const calls = (spy as any).mock.calls
  return JSON.parse(calls[calls.length - 1][0] as string)
}

/** Create the full .threados/ directory tree that initCommand would produce. */
async function initThreadOS(basePath: string): Promise<void> {
  const root = join(basePath, '.threados')
  await mkdir(join(root, 'prompts'), { recursive: true })
  await mkdir(join(root, 'runs'), { recursive: true })
  await mkdir(join(root, 'state'), { recursive: true })
}

/* ------------------------------------------------------------------ */
/*  Integration tests                                                  */
/* ------------------------------------------------------------------ */

describe('CLI lifecycle integration', () => {
  let tmpDir: string
  let cwdSpy: ReturnType<typeof spyOn>
  let logSpy: ReturnType<typeof spyOn>

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'threados-integ-'))
    cwdSpy = spyOn(process, 'cwd').mockReturnValue(tmpDir)
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    cwdSpy.mockRestore()
    logSpy.mockRestore()
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('full lifecycle: init, add steps, deps, gate, validate DAG, status', async () => {
    // -------- 1. Initialise .threados/ directory --------------------
    await initThreadOS(tmpDir)
    await access(join(tmpDir, '.threados'))
    await access(join(tmpDir, '.threados', 'prompts'))
    await access(join(tmpDir, '.threados', 'runs'))
    await access(join(tmpDir, '.threados', 'state'))

    // -------- 2. Write a sequence with five steps ------------------
    const sequence: Sequence = {
      version: '1.0',
      name: 'Integration Test Pipeline',
      steps: [
        {
          id: 'setup',
          name: 'Setup Environment',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/setup.md',
          depends_on: [],
          status: 'READY',
        },
        {
          id: 'build',
          name: 'Build Project',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/build.md',
          depends_on: [],
          status: 'READY',
        },
        {
          id: 'test-unit',
          name: 'Unit Tests',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/test-unit.md',
          depends_on: [],
          status: 'READY',
        },
        {
          id: 'test-integ',
          name: 'Integration Tests',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/test-integ.md',
          depends_on: [],
          status: 'READY',
        },
        {
          id: 'deploy',
          name: 'Deploy to Production',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/deploy.md',
          depends_on: [],
          status: 'READY',
        },
      ],
      gates: [],
    }

    await writeSequence(tmpDir, sequence)

    // Read back and sanity-check
    const initial = await readSequence(tmpDir)
    expect(initial.steps).toHaveLength(5)
    expect(initial.name).toBe('Integration Test Pipeline')

    // -------- 3. Wire up dependencies via depCommand ---------------
    // build -> setup
    await depCommand('add', ['build', 'setup'], JSON_OPTS)
    expect(lastJsonOutput(logSpy).success).toBe(true)

    // test-unit -> build
    await depCommand('add', ['test-unit', 'build'], JSON_OPTS)
    expect(lastJsonOutput(logSpy).success).toBe(true)

    // test-integ -> build
    await depCommand('add', ['test-integ', 'build'], JSON_OPTS)
    expect(lastJsonOutput(logSpy).success).toBe(true)

    // -------- 4. Insert a review gate after tests ------------------
    await gateCommand(
      'insert',
      ['review-gate', '--name', 'QA Review', '--depends-on', 'test-unit,test-integ'],
      JSON_OPTS,
    )
    expect(lastJsonOutput(logSpy).success).toBe(true)

    // deploy -> review-gate
    await depCommand('add', ['deploy', 'review-gate'], JSON_OPTS)
    expect(lastJsonOutput(logSpy).success).toBe(true)

    // -------- 5. Validate the DAG (no cycles) ----------------------
    const afterDeps = await readSequence(tmpDir)
    expect(() => validateDAG(afterDeps)).not.toThrow()

    // Topological sort should place setup first, deploy last
    const topoOrder = topologicalSort(afterDeps)
    expect(topoOrder.indexOf('setup')).toBeLessThan(topoOrder.indexOf('build'))
    expect(topoOrder.indexOf('build')).toBeLessThan(topoOrder.indexOf('test-unit'))
    expect(topoOrder.indexOf('build')).toBeLessThan(topoOrder.indexOf('test-integ'))
    expect(topoOrder.indexOf('review-gate')).toBeLessThan(topoOrder.indexOf('deploy'))

    // -------- 6. Verify the persisted dependency structure ----------
    const buildStep = afterDeps.steps.find(s => s.id === 'build')!
    expect(buildStep.depends_on).toContain('setup')

    const unitStep = afterDeps.steps.find(s => s.id === 'test-unit')!
    expect(unitStep.depends_on).toContain('build')

    const integStep = afterDeps.steps.find(s => s.id === 'test-integ')!
    expect(integStep.depends_on).toContain('build')

    const deployStep = afterDeps.steps.find(s => s.id === 'deploy')!
    expect(deployStep.depends_on).toContain('review-gate')

    const gate = afterDeps.gates.find(g => g.id === 'review-gate')!
    expect(gate.depends_on).toContain('test-unit')
    expect(gate.depends_on).toContain('test-integ')
    expect(gate.status).toBe('PENDING')

    // -------- 7. Check status via statusCommand --------------------
    logSpy.mockClear()
    await statusCommand(undefined, [], JSON_OPTS)

    const status = lastJsonOutput(logSpy) as any
    expect(status.name).toBe('Integration Test Pipeline')
    expect(status.steps).toHaveLength(5)
    expect(status.gates).toHaveLength(1)
    expect(status.summary.total).toBe(5)
    expect(status.gates[0].id).toBe('review-gate')
  })

  test('cycle detection prevents invalid dependency', async () => {
    await initThreadOS(tmpDir)

    // A -> B -> C, then try C -> A (creates cycle)
    const seq: Sequence = {
      version: '1.0',
      name: 'Cycle Test',
      steps: [
        {
          id: 'a',
          name: 'A',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/a.md',
          depends_on: [],
          status: 'READY',
        },
        {
          id: 'b',
          name: 'B',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/b.md',
          depends_on: ['a'],
          status: 'READY',
        },
        {
          id: 'c',
          name: 'C',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/c.md',
          depends_on: ['b'],
          status: 'READY',
        },
      ],
      gates: [],
    }

    await writeSequence(tmpDir, seq)

    // Try to add a -> c (creates a -> c -> b -> a cycle)
    await depCommand('add', ['a', 'c'], JSON_OPTS)
    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(false)
    expect(String(output.error)).toContain('Circular dependency')

    // Original DAG should remain unchanged
    const final = await readSequence(tmpDir)
    const stepA = final.steps.find(s => s.id === 'a')!
    expect(stepA.depends_on).not.toContain('c')
  })

  test('parallel group + status integration', async () => {
    await initThreadOS(tmpDir)

    const seq: Sequence = {
      version: '1.0',
      name: 'Parallel Group Test',
      steps: [
        {
          id: 'prep',
          name: 'Preparation',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/prep.md',
          depends_on: [],
          status: 'DONE',
        },
        {
          id: 'task-1',
          name: 'Task 1',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/t1.md',
          depends_on: ['prep'],
          status: 'READY',
        },
        {
          id: 'task-2',
          name: 'Task 2',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/t2.md',
          depends_on: ['prep'],
          status: 'READY',
        },
        {
          id: 'task-3',
          name: 'Task 3',
          type: 'base',
          model: 'claude-code',
          prompt_file: '.threados/prompts/t3.md',
          depends_on: ['prep'],
          status: 'READY',
        },
      ],
      gates: [],
    }

    await writeSequence(tmpDir, seq)

    // Parallelize the three tasks
    await groupCommand(
      'parallelize',
      ['task-1', 'task-2', 'task-3', '--group-id', 'parallel-batch'],
      JSON_OPTS,
    )
    expect(lastJsonOutput(logSpy).success).toBe(true)

    // Verify they share a group
    const final = await readSequence(tmpDir)
    for (const id of ['task-1', 'task-2', 'task-3']) {
      const step = final.steps.find(s => s.id === id)!
      expect(step.group_id).toBe('parallel-batch')
      expect(step.type).toBe('p')
    }

    // Status should report 4 total steps (1 DONE + 3 READY)
    logSpy.mockClear()
    await statusCommand(undefined, [], JSON_OPTS)
    const status = lastJsonOutput(logSpy) as any
    expect(status.summary.total).toBe(4)
    expect(status.summary.done).toBe(1)
    expect(status.summary.ready).toBe(3)
  })
})
