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
    policyConfirmed: true,
    ...overrides,
  } as NativeActionRuntime
}

describe('native action runtime contracts', () => {
  test('renders structured CLI arguments without treating runtime values as shell source and persists the payload for output_key', async () => {
    await writeRuntimeContext(basePath, { resolved_stage_id: 'stage-42' })
    let capturedCommand = ''
    let capturedArgs: string[] = []
    await executeNativeOperationalAction(basePath, sequence, step, 'run-1', runtime({
      runStep: async config => {
        capturedCommand = config.command
        capturedArgs = config.args ?? []
        return { stepId: config.stepId, runId: config.runId, exitCode: 0, status: 'SUCCESS', duration: 1, stdout: '{"id":"payload-1"}', stderr: '', startTime: new Date(), endTime: new Date() }
      },
    }), { id: 'cli', type: 'cli', config: { executable: 'echo', arguments: ['{{resolved_stage_id}}'] }, output_key: 'cli_result' })

    expect(capturedCommand).toBe('echo')
    expect(capturedArgs).toEqual(['stage-42'])
    expect((await readRuntimeContext(basePath)).cli_result).toEqual({ id: 'payload-1' })
  })


  test('rejects runtime interpolation inside shell source commands', async () => {
    await writeRuntimeContext(basePath, { item: { name: 'x; touch pwned' } })
    await expect(executeNativeOperationalAction(basePath, sequence, step, 'run-shell-injection', runtime(), {
      id: 'unsafe-cli', type: 'cli', config: { command: 'echo {{item.name}}' },
    })).rejects.toThrow('structured executable')
  })

  test('persists null for an output_key when a CLI action emits no stdout', async () => {
    await executeNativeOperationalAction(basePath, sequence, step, 'run-empty-output', runtime({
      runStep: async config => ({
        stepId: config.stepId, runId: config.runId, exitCode: 0, status: 'SUCCESS', duration: 1,
        stdout: '', stderr: '', startTime: new Date(), endTime: new Date(),
      }),
    }), { id: 'empty-cli', type: 'cli', config: { executable: 'echo', arguments: [] }, output_key: 'telegram_chat_id' })
    expect((await readRuntimeContext(basePath)).telegram_chat_id).toBeNull()
  })

  test('applies command policy before a native CLI action executes', async () => {
    const { mkdir, writeFile } = await import('fs/promises')
    await mkdir(join(basePath, '.threados'), { recursive: true })
    await writeFile(join(basePath, '.threados', 'policy.yaml'), 'mode: POWER\nforbidden_patterns:\n  - blocked-command\n')
    let calls = 0
    await expect(executeNativeOperationalAction(basePath, sequence, step, 'run-policy', runtime({
      runStep: async config => { calls += 1; return { stepId: config.stepId, runId: config.runId, exitCode: 0, status: 'SUCCESS', duration: 1, stdout: '', stderr: '', startTime: new Date(), endTime: new Date() } },
    }), { id: 'blocked-cli', type: 'cli', config: { executable: 'blocked-command', arguments: [] } })).rejects.toThrow('policy')
    expect(calls).toBe(0)
  })

  test('rejects structured CLI arguments that read non-allowlisted inherited environment secrets', async () => {
    const previous = process.env.AWS_SECRET_ACCESS_KEY
    process.env.AWS_SECRET_ACCESS_KEY = 'do-not-expose'
    try {
      await expect(executeNativeOperationalAction(basePath, sequence, step, 'run-env-secret', runtime(), {
        id: 'secret-cli', type: 'cli', config: { executable: process.execPath, arguments: ['${AWS_SECRET_ACCESS_KEY}'] },
      })).rejects.toThrow('not allowed')
    } finally {
      if (previous === undefined) delete process.env.AWS_SECRET_ACCESS_KEY
      else process.env.AWS_SECRET_ACCESS_KEY = previous
    }
  })

  test('rejects thredOS secret-bearing inherited environment variables', async () => {
    const previousSession = process.env.THREADOS_SESSION_SECRET
    const previousActivation = process.env.THREDOS_ACTIVATION_SECRET
    process.env.THREADOS_SESSION_SECRET = 'do-not-expose-session'
    process.env.THREDOS_ACTIVATION_SECRET = 'do-not-expose-activation'
    try {
      for (const envKey of ['THREADOS_SESSION_SECRET', 'THREDOS_ACTIVATION_SECRET']) {
        await expect(executeNativeOperationalAction(basePath, sequence, step, `run-${envKey}`, runtime(), {
          id: `secret-${envKey}`, type: 'cli', config: { executable: process.execPath, arguments: ['${' + envKey + '}'] },
        })).rejects.toThrow('not allowed')
      }
    } finally {
      if (previousSession === undefined) delete process.env.THREADOS_SESSION_SECRET
      else process.env.THREADOS_SESSION_SECRET = previousSession
      if (previousActivation === undefined) delete process.env.THREDOS_ACTIVATION_SECRET
      else process.env.THREDOS_ACTIVATION_SECRET = previousActivation
    }
  })

  test('allows structured CLI arguments to read THREADOS-prefixed inherited environment values', async () => {
    const previous = process.env.THREADOS_STATE_MANAGER_PATH
    process.env.THREADOS_STATE_MANAGER_PATH = 'safe-state-manager.py'
    let capturedArgs: string[] = []
    try {
      await executeNativeOperationalAction(basePath, sequence, step, 'run-env-allowed', runtime({
        runStep: async config => {
          capturedArgs = config.args ?? []
          return { stepId: config.stepId, runId: config.runId, exitCode: 0, status: 'SUCCESS', duration: 1, stdout: '', stderr: '', startTime: new Date(), endTime: new Date() }
        },
      }), { id: 'allowed-cli', type: 'cli', config: { executable: process.execPath, arguments: ['${THREADOS_STATE_MANAGER_PATH}'] } })
      expect(capturedArgs).toEqual(['safe-state-manager.py'])
    } finally {
      if (previous === undefined) delete process.env.THREADOS_STATE_MANAGER_PATH
      else process.env.THREADOS_STATE_MANAGER_PATH = previous
    }
  })

  test('requires explicit SAFE confirmation before a native CLI action executes', async () => {
    let calls = 0
    const unconfirmed = { ...runtime(), policyConfirmed: false } as NativeActionRuntime
    await expect(executeNativeOperationalAction(basePath, sequence, step, 'run-confirmation', {
      ...unconfirmed,
      runStep: async config => { calls += 1; return { stepId: config.stepId, runId: config.runId, exitCode: 0, status: 'SUCCESS', duration: 1, stdout: '', stderr: '', startTime: new Date(), endTime: new Date() } },
    }, { id: 'safe-cli', type: 'cli', config: { executable: process.execPath, arguments: ['-e', 'process.exit(0)'] } })).rejects.toThrow('explicit confirmation')
    expect(calls).toBe(0)
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
