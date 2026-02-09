import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import YAML from 'yaml'
import { groupCommand } from './group'
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

/** Three independent worker steps, no group_id yet. */
function makeSequence(): Sequence {
  return {
    version: '1.0',
    name: 'Group Test Sequence',
    steps: [
      {
        id: 'worker-1',
        name: 'Worker 1',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/w1.md',
        depends_on: [],
        status: 'READY',
      },
      {
        id: 'worker-2',
        name: 'Worker 2',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/w2.md',
        depends_on: [],
        status: 'READY',
      },
      {
        id: 'worker-3',
        name: 'Worker 3',
        type: 'base',
        model: 'claude-code',
        prompt_file: '.threados/prompts/w3.md',
        depends_on: [],
        status: 'READY',
      },
    ],
    gates: [],
  }
}

function lastJsonOutput(spy: ReturnType<typeof spyOn>): Record<string, unknown> {
  const calls = spy.mock.calls as unknown[][]
  const lastCall = calls[calls.length - 1]
  const parsed: unknown = JSON.parse(String(lastCall[0]))
  return parsed as Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('groupCommand', () => {
  let tmpDir: string
  let cwdSpy: ReturnType<typeof spyOn>
  let logSpy: ReturnType<typeof spyOn>

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'group-test-'))
    await setupSequence(tmpDir, makeSequence())
    cwdSpy = spyOn(process, 'cwd').mockReturnValue(tmpDir)
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    cwdSpy.mockRestore()
    logSpy.mockRestore()
    await rm(tmpDir, { recursive: true, force: true })
  })

  // ---- parallelize ------------------------------------------------

  test('parallelize steps sets group_id and type', async () => {
    await groupCommand(
      'parallelize',
      ['worker-1', 'worker-2', '--group-id', 'my-group'],
      JSON_OPTS,
    )

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(true)
    expect(output.groupId).toBe('my-group')
    expect(output.steps).toEqual(['worker-1', 'worker-2'])

    // Verify persistence
    const seq = await readSequence(tmpDir)
    const w1 = seq.steps.find(s => s.id === 'worker-1')!
    const w2 = seq.steps.find(s => s.id === 'worker-2')!
    const w3 = seq.steps.find(s => s.id === 'worker-3')!

    expect(w1.group_id).toBe('my-group')
    expect(w1.type).toBe('p')
    expect(w2.group_id).toBe('my-group')
    expect(w2.type).toBe('p')
    // worker-3 was NOT included
    expect(w3.group_id).toBeUndefined()
    expect(w3.type).toBe('base')
  })

  // ---- list -------------------------------------------------------

  test('list groups', async () => {
    // First create a group
    await groupCommand(
      'parallelize',
      ['worker-1', 'worker-2', 'worker-3', '--group-id', 'grp-alpha'],
      JSON_OPTS,
    )
    logSpy.mockClear()

    // Now list
    await groupCommand('list', [], JSON_OPTS)

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(true)
    expect(output.groups).toHaveLength(1)
    const groups = output.groups as Array<{ groupId: string; steps: Array<{ id: string }> }>
    expect(groups[0].groupId).toBe('grp-alpha')
    expect(groups[0].steps).toHaveLength(3)
    expect(groups[0].steps.map((s) => s.id).sort()).toEqual([
      'worker-1',
      'worker-2',
      'worker-3',
    ])
  })

  // ---- error: non-existent step -----------------------------------

  test('non-existent step returns error', async () => {
    await groupCommand(
      'parallelize',
      ['worker-1', 'does-not-exist'],
      JSON_OPTS,
    )

    const output = lastJsonOutput(logSpy)
    expect(output.success).toBe(false)
    expect(String(output.error)).toContain('Step not found')
  })
})
