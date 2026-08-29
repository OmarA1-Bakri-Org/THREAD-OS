import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { prepareStepPromptForDispatch, renderStepActionContract, resolveStepPromptPath } from './step-preparation'
import type { Sequence, Step } from '../sequence/schema'

let basePath = ''

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: 'shell-step', name: 'Shell step', type: 'base', model: 'shell',
  prompt_file: '.threados/prompts/wrong.md',
  prompt_ref: { id: 'shell-step', version: 1, path: '.threados/prompts/shell-step.md' },
  depends_on: [], status: 'READY', actions: [{ id: 'run', type: 'cli', config: { command: 'echo secret', arguments: { token: 'abc' } } }],
  ...overrides,
} as Step)

const makeSequence = (step: Step): Sequence => ({ version: '1.0', name: 'Test', steps: [step], gates: [] } as Sequence)

beforeEach(async () => {
  basePath = await mkdtemp(join(tmpdir(), 'threados-step-prep-'))
  await mkdir(join(basePath, '.threados', 'prompts'), { recursive: true })
})

afterEach(async () => { await rm(basePath, { recursive: true, force: true }) })

describe('step preparation safety', () => {
  test('resolves the same prompt_ref path that is recorded in evidence', async () => {
    const step = makeStep()
    await writeFile(join(basePath, '.threados', 'prompts', 'shell-step.md'), '#!/bin/sh\necho ok\n', 'utf-8')
    expect(resolveStepPromptPath(basePath, step)).toBe(join(basePath, '.threados', 'prompts', 'shell-step.md'))
  })

  test('does not append action-contract JSON to executable shell prompts', async () => {
    const step = makeStep()
    const script = '#!/bin/sh\necho ok\n'
    await writeFile(join(basePath, '.threados', 'prompts', 'shell-step.md'), script, 'utf-8')
    const prepared = await prepareStepPromptForDispatch({ stepId: step.id, step, sequence: makeSequence(step), basePath, maxTokens: 4000 })
    expect(prepared.promptForDispatch).toBe(script)
    expect(prepared.promptForDispatch).not.toContain('THREADOS ACTION CONTRACT')
  })

  test('redacts executable commands, arguments, and secret-like values from rendered action contracts', () => {
    const rendered = renderStepActionContract(makeStep({ model: 'codex' }))
    expect(rendered).toContain('THREADOS ACTION CONTRACT')
    expect(rendered).not.toContain('echo secret')
    expect(rendered).not.toContain('abc')
    expect(rendered).toContain('[REDACTED]')
  })
})
