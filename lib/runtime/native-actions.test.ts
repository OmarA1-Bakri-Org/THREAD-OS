import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { executeNativeOperationalAction } from './native-actions'
import { readRuntimeContext, writeRuntimeContext } from './context'
import type { NativeActionRuntime } from './native-actions'
import type { Sequence, Step } from '../sequence/schema'

let basePath = ''
const step: Step = { id: 'native', name: 'Native', type: 'base', model: 'codex', prompt_file: '.threados/prompts/native.md', depends_on: [], status: 'READY' }
const sequence = { version: '1.0', name: 'Native tests', steps: [step], gates: [] } as Sequence

beforeEach(async () => { basePath = await mkdtemp(join(tmpdir(), 'threados-native-actions-')) })
afterEach(async () => { await rm(basePath, { recursive: true, force: true }) })

function runtime(overrides: Partial<NativeActionRuntime> = {}): NativeActionRuntime {
  return {
    dispatch: async () => { throw new Error('dispatch not expected') },
    runStep: async config => ({
      stepId: config.stepId, runId: config.runId, exitCode: 0, status: 'SUCCESS', duration: 1,
      stdout: '{"id":"payload-1"}', stderr: '', startTime: new Date(), endTime: new Date(),
    }),
    ...overrides,
  } as NativeActionRuntime
}

describe('native action runtime contracts', () => {
  test('renders CLI command templates, uses a non-login shell, and persists the payload for output_key', async () => {
    await writeRuntimeContext(basePath, { resolved_stage_id: 'stage-42' })
    let capturedArgs: string[] = []
    await executeNativeOperationalAction(basePath, sequence, step, 'run-1', runtime({
      runStep: async config => {
        capturedArgs = config.args ?? []
        return { stepId: config.stepId, runId: config.runId, exitCode: 0, status: 'SUCCESS', duration: 1, stdout: '{"id":"payload-1"}', stderr: '', startTime: new Date(), endTime: new Date() }
      },
    }), { id: 'cli', type: 'cli', config: { command: 'echo {{resolved_stage_id}}' }, output_key: 'cli_result' })

    expect(capturedArgs).toEqual(['-c', 'echo stage-42'])
    expect((await readRuntimeContext(basePath)).cli_result).toEqual({ id: 'payload-1' })
  })

  test('renders nested Composio arguments from hydrated runtime context', async () => {
    await writeRuntimeContext(basePath, { item: { email: 'person@example.com' } })
    let captured: Record<string, unknown> = {}
    await executeNativeOperationalAction(basePath, sequence, step, 'run-2', runtime({
      runComposioTool: async input => { captured = input.arguments; return { ok: true } },
    }), { id: 'tool', type: 'composio_tool', config: { tool_slug: 'APOLLO_TEST', arguments: { contact: { email: '{{item.email}}' } } } })
    expect(captured).toEqual({ contact: { email: 'person@example.com' } })
  })

  test('preserves the original Composio error as the cause', async () => {
    const original = new TypeError('provider exploded')
    try {
      await executeNativeOperationalAction(basePath, sequence, step, 'run-3', runtime({
        runComposioTool: async () => { throw original },
      }), { id: 'tool', type: 'composio_tool', config: { tool_slug: 'APOLLO_TEST', arguments: {} } })
      throw new Error('expected failure')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).cause).toBe(original)
    }
  })
})
