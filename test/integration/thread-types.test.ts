import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTempDir, cleanTempDir } from '../helpers/setup'
import { initCommand } from '../../lib/seqctl/commands/init'
import { stepCommand } from '../../lib/seqctl/commands/step'
import { depCommand } from '../../lib/seqctl/commands/dep'
import { groupCommand } from '../../lib/seqctl/commands/group'
import { fusionCommand } from '../../lib/seqctl/commands/fusion'
import { gateCommand } from '../../lib/seqctl/commands/gate'
import { templateCommand } from '../../lib/seqctl/commands/template'
import { readSequence } from '../../lib/sequence/parser'

const jsonOpts = { json: true, help: false, watch: false }
const silentOpts = { json: false, help: false, watch: false }

function captureLog(): { logs: string[]; restore: () => void } {
  const logs: string[] = []
  const origLog = console.log
  const origErr = console.error
  console.log = (msg: string) => logs.push(String(msg))
  console.error = (msg: string) => logs.push(String(msg))
  return { logs, restore: () => { console.log = origLog; console.error = origErr } }
}

describe('thread types integration', () => {
  let tmpDir: string
  let origCwd: string

  beforeEach(async () => {
    origCwd = process.cwd()
    tmpDir = await createTempDir()
    process.chdir(tmpDir)
    await initCommand(undefined, [], silentOpts)
  })

  afterEach(async () => {
    process.chdir(origCwd)
    await cleanTempDir(tmpDir)
  })

  test('base template apply', async () => {
    const { logs, restore } = captureLog()
    await templateCommand('apply', ['base'], jsonOpts)
    restore()

    const result = JSON.parse(logs[0])
    expect(result.success).toBe(true)

    const seq = await readSequence(tmpDir)
    expect(seq.steps.length).toBeGreaterThan(0)
  })

  test('parallel: group parallelize', async () => {
    const { logs, restore } = captureLog()
    await stepCommand('add', ['p1', '-n', 'P1', '-t', 'base', '-m', 'claude-code'], jsonOpts)
    await stepCommand('add', ['p2', '-n', 'P2', '-t', 'base', '-m', 'claude-code'], jsonOpts)
    await groupCommand('parallelize', ['p1', 'p2'], jsonOpts)
    restore()

    const seq = await readSequence(tmpDir)
    const grouped = seq.steps.filter(s => s.group_id !== undefined)
    expect(grouped.length).toBe(2)
  })

  test('chained: steps with gate', async () => {
    const { logs, restore } = captureLog()
    await stepCommand('add', ['c1', '-n', 'C1', '-t', 'base', '-m', 'claude-code'], jsonOpts)
    await stepCommand('add', ['c2', '-n', 'C2', '-t', 'base', '-m', 'claude-code'], jsonOpts)
    await gateCommand('insert', ['review-gate', '-n', 'ReviewGate', 'c1'], jsonOpts)
    await depCommand('add', ['c2', 'review-gate'], jsonOpts)
    restore()

    const seq = await readSequence(tmpDir)
    expect(seq.gates.length).toBeGreaterThanOrEqual(1)
    const c2 = seq.steps.find(s => s.id === 'c2')
    expect(c2?.depends_on).toContain('review-gate')
  })

  test('fusion: create fusion steps', async () => {
    const { logs, restore } = captureLog()
    await stepCommand('add', ['cand1', '-n', 'Candidate1', '-t', 'base', '-m', 'claude-code'], jsonOpts)
    await stepCommand('add', ['cand2', '-n', 'Candidate2', '-t', 'base', '-m', 'claude-code'], jsonOpts)
    await fusionCommand('create', ['--candidates', 'cand1,cand2', '--synth', 'synth-1'], jsonOpts)
    restore()

    const seq = await readSequence(tmpDir)
    const synth = seq.steps.find(s => s.id === 'synth-1')
    expect(synth).toBeDefined()
    expect(synth!.fusion_synth).toBe(true)
    expect(synth!.depends_on).toContain('cand1')
    expect(synth!.depends_on).toContain('cand2')
  })
})
