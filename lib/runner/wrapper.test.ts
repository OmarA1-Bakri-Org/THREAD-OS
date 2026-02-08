import { describe, test, expect } from 'bun:test'
import { runStep } from './wrapper'
import { ProcessTimeoutError } from '../errors'

describe('runStep', () => {
  test('successful command', async () => {
    const result = await runStep({
      stepId: 'test-step',
      runId: 'run-1',
      command: 'echo hello',
    })
    expect(result.status).toBe('SUCCESS')
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.stepId).toBe('test-step')
    expect(result.runId).toBe('run-1')
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.startTime).toBeInstanceOf(Date)
    expect(result.endTime).toBeInstanceOf(Date)
  })

  test('failed command', async () => {
    const result = await runStep({
      stepId: 'fail-step',
      runId: 'run-2',
      command: 'sh -c "exit 1"',
    })
    expect(result.status).toBe('FAILED')
    expect(result.exitCode).toBe(1)
  })

  test('command with stderr', async () => {
    const result = await runStep({
      stepId: 'stderr-step',
      runId: 'run-3',
      command: 'sh -c "echo error >&2"',
    })
    expect(result.stderr.trim()).toBe('error')
  })

  test('timeout kills process', async () => {
    await expect(
      runStep({
        stepId: 'timeout-step',
        runId: 'run-4',
        command: 'sleep 60',
        timeout: 100,
      })
    ).rejects.toThrow(ProcessTimeoutError)
  })

  test('nonexistent command returns FAILED via shell', async () => {
    // shell: true means the shell returns 127 for not found
    const result = await runStep({
      stepId: 'bad-cmd',
      runId: 'run-5',
      command: 'nonexistent_command_xyz',
    })
    expect(result.status).toBe('FAILED')
    expect(result.exitCode).toBe(127)
  })

  test('custom env vars', async () => {
    const result = await runStep({
      stepId: 'env-step',
      runId: 'run-6',
      command: 'echo $MY_VAR',
      env: { MY_VAR: 'test-value' },
    })
    expect(result.stdout.trim()).toBe('test-value')
  })
})
