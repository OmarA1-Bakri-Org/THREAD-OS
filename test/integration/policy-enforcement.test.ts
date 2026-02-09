import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import YAML from 'yaml'
import { createTempDir, cleanTempDir } from '../helpers/setup'
import { PolicyEngine } from '../../lib/policy/engine'

describe('policy enforcement integration', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await createTempDir()
    await mkdir(join(tmpDir, '.threados'), { recursive: true })
  })

  afterEach(async () => {
    await cleanTempDir(tmpDir)
  })

  test('forbidden pattern denies command', async () => {
    await writeFile(join(tmpDir, '.threados/policy.yaml'), YAML.stringify({
      mode: 'POWER',
      forbidden_patterns: ['rm\\s+-rf'],
    }))

    const engine = await PolicyEngine.load(tmpDir)
    const result = engine.validate({ type: 'run_command', command: 'rm -rf /important' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('forbidden')
  })

  test('SAFE mode requires confirmation', async () => {
    await writeFile(join(tmpDir, '.threados/policy.yaml'), YAML.stringify({
      mode: 'SAFE',
    }))

    const engine = await PolicyEngine.load(tmpDir)
    const result = engine.validate({ type: 'run_command', command: 'echo safe' })
    expect(result.allowed).toBe(true)
    expect(result.confirmation_required).toBe(true)
  })

  test('POWER mode allows without confirmation', async () => {
    await writeFile(join(tmpDir, '.threados/policy.yaml'), YAML.stringify({
      mode: 'POWER',
    }))

    const engine = await PolicyEngine.load(tmpDir)
    const result = engine.validate({ type: 'run_command', command: 'echo go' })
    expect(result.allowed).toBe(true)
    expect(result.confirmation_required).toBe(false)
  })

  test('combined: allowlist + forbidden', async () => {
    await writeFile(join(tmpDir, '.threados/policy.yaml'), YAML.stringify({
      mode: 'POWER',
      command_allowlist: ['echo', 'cat'],
      forbidden_patterns: ['echo.*secret'],
    }))

    const engine = await PolicyEngine.load(tmpDir)
    // Allowed and not forbidden
    expect(engine.validate({ type: 'run_command', command: 'echo hello' }).allowed).toBe(true)
    // Forbidden takes priority
    expect(engine.validate({ type: 'run_command', command: 'echo secret-data' }).allowed).toBe(false)
    // Not in allowlist
    expect(engine.validate({ type: 'run_command', command: 'rm file' }).allowed).toBe(false)
  })
})
