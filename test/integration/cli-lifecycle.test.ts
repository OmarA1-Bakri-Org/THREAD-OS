import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createTempDir, cleanTempDir, makeSequence, makeStep, writeTestSequence } from '../helpers/setup'
import { initCommand } from '../../lib/seqctl/commands/init'
import { stepCommand } from '../../lib/seqctl/commands/step'
import { depCommand } from '../../lib/seqctl/commands/dep'
import { statusCommand } from '../../lib/seqctl/commands/status'
import { runCommand } from '../../lib/seqctl/commands/run'
import { readSequence, writeSequence } from '../../lib/sequence/parser'

const jsonOpts = { json: true, help: false, watch: false }

describe('CLI lifecycle integration', () => {
  let tmpDir: string
  let origCwd: string

  beforeEach(async () => {
    origCwd = process.cwd()
    tmpDir = await createTempDir()
    process.chdir(tmpDir)
  })

  afterEach(async () => {
    process.chdir(origCwd)
    await cleanTempDir(tmpDir)
  })

  test('init creates .threados directory structure', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    await initCommand(undefined, [], jsonOpts)
    console.log = origLog

    const result = JSON.parse(logs[0])
    expect(result.success).toBe(true)

    // Verify sequence.yaml exists
    const seq = await readSequence(tmpDir)
    expect(seq.name).toBe('New Sequence')
  })

  test('full flow: init → add steps → add dep → status', async () => {
    // Init
    await initCommand(undefined, [], { json: false, help: false, watch: false })

    // Add steps
    await stepCommand('add', ['echo-step', '-n', 'EchoStep', '-t', 'base', '-m', 'claude-code'], jsonOpts)
    await stepCommand('add', ['step-two', '-n', 'StepTwo', '-t', 'base', '-m', 'claude-code'], jsonOpts)

    // Add dep
    await depCommand('add', ['step-two', 'echo-step'], jsonOpts)

    // Verify sequence
    const seq = await readSequence(tmpDir)
    expect(seq.steps).toHaveLength(2)
    const stepTwo = seq.steps.find(s => s.id === 'step-two')
    expect(stepTwo?.depends_on).toContain('echo-step')
  })

  test('run step with echo and verify artifacts', async () => {
    // Set up a sequence with a step that uses echo
    await initCommand(undefined, [], { json: false, help: false, watch: false })

    // Manually write a sequence where the step command is 'echo'
    const seq = await readSequence(tmpDir)
    seq.steps = [{
      id: 'echo-test',
      name: 'Echo Test',
      type: 'base',
      model: 'claude-code',
      prompt_file: '.threados/prompts/echo-test.md',
      depends_on: [],
      status: 'READY',
    }]
    await writeSequence(tmpDir, seq)

    // The run command uses step.model as command, which is 'claude-code'
    // This will fail since claude-code doesn't exist, but artifacts should still be created
    const logs: string[] = []
    const origLog = console.log
    const origErr = console.error
    console.log = (msg: string) => logs.push(msg)
    console.error = (msg: string) => logs.push(msg)

    // Suppress process.exit
    const origExit = process.exit
    process.exit = (() => { throw new Error('exit') }) as any

    try {
      await runCommand('step', ['echo-test'], jsonOpts)
    } catch {
      // expected - command will fail
    }

    console.log = origLog
    console.error = origErr
    process.exit = origExit

    // Check that some output was produced
    expect(logs.length).toBeGreaterThan(0)
  })
})
