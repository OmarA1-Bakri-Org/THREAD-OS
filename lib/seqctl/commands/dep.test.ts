import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import YAML from 'yaml'
import { depCommand } from './dep'
import { readSequence } from '../../sequence/parser'
import type { Sequence } from '../../sequence/schema'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const JSON_OPTS = { json: true, help: false, watch: false } as const

/** Write a raw Sequence object as YAML into <basePath>/.threados/sequence.yaml */
async function setupSequence(basePath: string, sequence: Sequence): Promise<void> {
  const dir = join(basePath, '.threados')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'sequence.yaml'), YAML.stringify(sequence), 'utf-8')
}

/** Return a baseline sequence with three steps (step-c depends on step-b). */
function makeSequence(overrides?: Partial<Sequence>): Sequence {
  return {
    version: '1.0',
    name: 'Dep Test Sequence',
    steps: [
      {
        id: 'step-a',
        name: 'Step A',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/a.md',
        depends_on: [],
        status: 'READY',
      },
      {
        id: 'step-b',
        name: 'Step B',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/b.md',
        depends_on: [],
        status: 'READY',
      },
      {
        id: 'step-c',
        name: 'Step C',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/c.md',
        depends_on: ['step-b'],
        status: 'READY',
      },
    ],
    gates: [],
    ...overrides,
  }
}

/** Extract the last JSON blob that was passed to console.log */
function lastJsonOutput(spy: ReturnType<typeof spyOn>): Record<string, unknown> {
  interface MockSpy {
    mock: {
      calls: Array<[string]>
    }
  }
  const calls = (spy as unknown as MockSpy).mock.calls
  return JSON.parse(calls[calls.length - 1][0] as string)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('depCommand', () => {
  let tmpDir: string
  let cwdSpy: ReturnType<typeof spyOn>
  let logSpy: ReturnType<typeof spyOn>

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'dep-test-'))
    await setupSequence(tmpDir, makeSequence())
    cwdSpy = spyOn(process, 'cwd').mockReturnValue(tmpDir)
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    cwdSpy.mockRestore()
    logSpy.mockRestore()
    await rm(tmpDir, { recursive: true, force: true })
  })

  // ---- add --------------------------------------------------------

  test('add dependency successfully', async () => {
    await depCommand('add', ['step-b', 'step-a'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(true)
    expect(output.action).toBe('add')
    expect(output.stepId).toBe('step-b')
    expect(output.depId).toBe('step-a')

    // Verify the dependency was persisted
    const seq = await readSequence(tmpDir)
    const stepB = seq.steps.find(s => s.id === 'step-b')!
    expect(stepB.depends_on).toContain('step-a')
  })

  test('add dependency that creates cycle returns error', async () => {
    // step-c already depends on step-b.
    // Adding step-b -> step-c would create: step-b -> step-c -> step-b
    await depCommand('add', ['step-b', 'step-c'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(false)
    expect(output.error).toBeDefined()
    expect(String(output.error)).toContain('Circular dependency')

    // Verify the dependency was NOT persisted (rolled back)
    const seq = await readSequence(tmpDir)
    const stepB = seq.steps.find(s => s.id === 'step-b')!
    expect(stepB.depends_on).not.toContain('step-c')
  })

  test('add dependency to non-existent step returns error', async () => {
    await depCommand('add', ['nonexistent', 'step-a'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(false)
    expect(String(output.error)).toContain('Step not found')
  })

  // ---- rm ---------------------------------------------------------

  test('remove dependency successfully', async () => {
    // step-c depends on step-b; remove that edge
    await depCommand('rm', ['step-c', 'step-b'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(true)
    expect(output.action).toBe('rm')
    expect(output.stepId).toBe('step-c')
    expect(output.depId).toBe('step-b')

    // Verify the dependency was removed from disk
    const seq = await readSequence(tmpDir)
    const stepC = seq.steps.find(s => s.id === 'step-c')!
    expect(stepC.depends_on).not.toContain('step-b')
    expect(stepC.depends_on).toHaveLength(0)
  })

  test('remove non-existent dependency returns error', async () => {
    // step-a does NOT depend on step-b
    await depCommand('rm', ['step-a', 'step-b'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(false)
    expect(String(output.error)).toContain('does not depend on')
  })
})
