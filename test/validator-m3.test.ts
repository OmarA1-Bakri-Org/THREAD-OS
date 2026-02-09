import { describe, it, expect, beforeEach } from 'bun:test'
import { ActionValidator } from '../lib/chat/validator'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'

const TEST_DIR = '/tmp/validator-test-' + Date.now()

describe('chat/validator M3 extension fields', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(TEST_DIR, { recursive: true })
    await mkdir(join(TEST_DIR, '.threados'), { recursive: true })
    await writeFile(
      join(TEST_DIR, '.threados', 'sequence.yaml'),
      `version: "1.0"
name: test-sequence
steps:
  - id: test-step
    name: Test Step
    type: base
    model: claude-code
    prompt_file: prompts/test.md
    depends_on: []
    status: READY
gates: []
`
    )
  })

  it('should handle group_id field update', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', group_id: 'group-1' },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('group_id: group-1')
  })

  it('should handle fanout field update with valid number', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', fanout: 5 },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('fanout: 5')
  })

  it('should reject fanout field update with invalid number', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', fanout: 'not-a-number' },
      },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Invalid fanout')
  })

  it('should handle fusion_candidates boolean field', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', fusion_candidates: true },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('fusion_candidates: true')
  })

  it('should handle fusion_synth boolean field', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', fusion_synth: true },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('fusion_synth: true')
  })

  it('should handle watchdog_for field update', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', watchdog_for: 'other-step' },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('watchdog_for: other-step')
  })

  it('should handle orchestrator field update', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', orchestrator: 'main-orchestrator' },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('orchestrator: main-orchestrator')
  })

  it('should handle timeout_ms field update with valid number', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', timeout_ms: 30000 },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('timeout_ms: 30000')
  })

  it('should reject timeout_ms field update with invalid number', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', timeout_ms: 'not-a-number' },
      },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Invalid timeout_ms')
  })

  it('should handle fail_policy field update with valid enum value', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', fail_policy: 'stop-all' },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('fail_policy: stop-all')
  })

  it('should reject fail_policy field update with invalid enum value', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: { id: 'test-step', fail_policy: 'invalid-policy' },
      },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Invalid fail_policy')
  })

  it('should handle multiple M3 fields in one update', async () => {
    const validator = new ActionValidator(TEST_DIR)
    const result = await validator.dryRun([
      {
        command: 'step update',
        args: {
          id: 'test-step',
          group_id: 'group-1',
          fanout: 3,
          fusion_candidates: true,
          timeout_ms: 60000,
          fail_policy: 'continue',
        },
      },
    ])
    expect(result.valid).toBe(true)
    expect(result.diff).toContain('group_id: group-1')
    expect(result.diff).toContain('fanout: 3')
    expect(result.diff).toContain('fusion_candidates: true')
    expect(result.diff).toContain('timeout_ms: 60000')
    expect(result.diff).toContain('fail_policy: continue')
  })
})
