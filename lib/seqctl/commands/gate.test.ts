import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import YAML from 'yaml'
import { gateCommand } from './gate'
import { readSequence } from '../../sequence/parser'
import type { Sequence } from '../../sequence/schema'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const JSON_OPTS = { json: true, help: false, watch: false } as const

async function setupSequence(basePath: string, sequence: Sequence): Promise<void> {
  const dir = join(basePath, '.threados')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'sequence.yaml'), YAML.stringify(sequence), 'utf-8')
}

/**
 * Baseline sequence:
 *   step-a (DONE) ──> gate-1 (PENDING) ──> step-b (BLOCKED)
 */
function makeSequence(overrides?: Partial<Sequence>): Sequence {
  return {
    version: '1.0',
    name: 'Gate Test Sequence',
    steps: [
      {
        id: 'step-a',
        name: 'Step A',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/a.md',
        depends_on: [],
        status: 'DONE',
      },
      {
        id: 'step-b',
        name: 'Step B',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/b.md',
        depends_on: ['gate-1'],
        status: 'BLOCKED',
      },
    ],
    gates: [
      {
        id: 'gate-1',
        name: 'Review Gate',
        depends_on: ['step-a'],
        status: 'PENDING',
      },
    ],
    ...overrides,
  }
}

function lastJsonOutput(spy: ReturnType<typeof spyOn>): Record<string, unknown> {
  const calls = (spy as any).mock.calls
  return JSON.parse(calls[calls.length - 1][0] as string)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('gateCommand', () => {
  let tmpDir: string
  let cwdSpy: ReturnType<typeof spyOn>
  let logSpy: ReturnType<typeof spyOn>

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gate-test-'))
    await setupSequence(tmpDir, makeSequence())
    cwdSpy = spyOn(process, 'cwd').mockReturnValue(tmpDir)
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    cwdSpy.mockRestore()
    logSpy.mockRestore()
    await rm(tmpDir, { recursive: true, force: true })
  })

  // ---- insert -----------------------------------------------------

  test('insert gate successfully', async () => {
    await gateCommand('insert', ['gate-2', '--name', 'Second Gate'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(true)
    expect(output.gateId).toBe('gate-2')

    // Verify gate was persisted
    const seq = await readSequence(tmpDir)
    const gate = seq.gates.find(g => g.id === 'gate-2')
    expect(gate).toBeDefined()
    expect(gate!.name).toBe('Second Gate')
    expect(gate!.status).toBe('PENDING')
  })

  // ---- approve ----------------------------------------------------

  test('approve gate unblocks dependent steps', async () => {
    // step-b is BLOCKED and depends on gate-1.
    // step-a (gate-1's only dependency) is already DONE.
    // Approving gate-1 should flip step-b to READY.
    await gateCommand('approve', ['gate-1'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(true)
    expect(output.action).toBe('approve')

    const seq = await readSequence(tmpDir)

    const gate = seq.gates.find(g => g.id === 'gate-1')!
    expect(gate.status).toBe('APPROVED')

    const stepB = seq.steps.find(s => s.id === 'step-b')!
    expect(stepB.status).toBe('READY')
  })

  // ---- block ------------------------------------------------------

  test('block gate', async () => {
    await gateCommand('block', ['gate-1'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(true)
    expect(output.action).toBe('block')

    const seq = await readSequence(tmpDir)
    const gate = seq.gates.find(g => g.id === 'gate-1')!
    expect(gate.status).toBe('BLOCKED')
  })

  // ---- list -------------------------------------------------------

  test('list gates', async () => {
    await gateCommand('list', [], JSON_OPTS)

    const output = lastJsonOutput(logSpy) as any
    expect(output.success).toBe(true)
    expect(output.action).toBe('list')
    expect(output.gates).toHaveLength(1)
    expect(output.gates[0].id).toBe('gate-1')
    expect(output.gates[0].status).toBe('PENDING')
    expect(output.gates[0].depends_on).toContain('step-a')
  })

  // ---- duplicate --------------------------------------------------

  test('insert duplicate gate returns error', async () => {
    await gateCommand('insert', ['gate-1', '--name', 'Duplicate'], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(false)
    expect(String(output.error)).toContain('already exists')
  })
})
