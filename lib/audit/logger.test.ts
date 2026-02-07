import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { AuditLogger, type AuditEntry } from './logger'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string
let logger: AuditLogger

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'threados-test-'))
  logger = new AuditLogger(tmpDir)
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

function baseEntry(overrides: Partial<Omit<AuditEntry, 'timestamp'>> = {}): Omit<AuditEntry, 'timestamp'> {
  return {
    actor: 'user',
    action: 'step.add',
    target: 'step-1',
    payload: {},
    policy_mode: 'SAFE',
    result: 'success',
    ...overrides,
  }
}

// ===========================================================================
// log()
// ===========================================================================

describe('AuditLogger.log', () => {
  test('appends a JSONL entry to the log file', async () => {
    await logger.log(baseEntry())

    const content = await readFile(join(tmpDir, '.threados/audit.log'), 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(1)

    const parsed = JSON.parse(lines[0]) as AuditEntry
    expect(parsed.actor).toBe('user')
    expect(parsed.action).toBe('step.add')
    expect(parsed.target).toBe('step-1')
    expect(parsed.result).toBe('success')
    expect(parsed.policy_mode).toBe('SAFE')
  })

  test('includes a timestamp in ISO format', async () => {
    const before = new Date().toISOString()
    await logger.log(baseEntry())
    const after = new Date().toISOString()

    const entries = await logger.read()
    expect(entries).toHaveLength(1)

    const ts = entries[0].timestamp
    expect(ts >= before).toBe(true)
    expect(ts <= after).toBe(true)
  })

  test('appends multiple entries in order', async () => {
    await logger.log(baseEntry({ action: 'first' }))
    await logger.log(baseEntry({ action: 'second' }))
    await logger.log(baseEntry({ action: 'third' }))

    const entries = await logger.read()
    expect(entries).toHaveLength(3)
    expect(entries[0].action).toBe('first')
    expect(entries[1].action).toBe('second')
    expect(entries[2].action).toBe('third')
  })

  test('creates .threados directory if it does not exist', async () => {
    const freshDir = await mkdtemp(join(tmpdir(), 'threados-test-fresh-'))
    try {
      const freshLogger = new AuditLogger(freshDir)
      await freshLogger.log(baseEntry())

      const entries = await freshLogger.read()
      expect(entries).toHaveLength(1)
    } finally {
      await rm(freshDir, { recursive: true, force: true })
    }
  })

  test('preserves payload data', async () => {
    await logger.log(baseEntry({
      payload: { key: 'value', nested: { a: 1 } },
    }))

    const entries = await logger.read()
    expect(entries[0].payload).toEqual({ key: 'value', nested: { a: 1 } })
  })

  test('preserves error field', async () => {
    await logger.log(baseEntry({
      result: 'error',
      error: 'Something went wrong',
    }))

    const entries = await logger.read()
    expect(entries[0].result).toBe('error')
    expect(entries[0].error).toBe('Something went wrong')
  })
})

// ===========================================================================
// read()
// ===========================================================================

describe('AuditLogger.read', () => {
  test('returns empty array when log file does not exist', async () => {
    const entries = await logger.read()
    expect(entries).toEqual([])
  })

  test('returns all entries without options', async () => {
    await logger.log(baseEntry({ action: 'a' }))
    await logger.log(baseEntry({ action: 'b' }))
    await logger.log(baseEntry({ action: 'c' }))

    const entries = await logger.read()
    expect(entries).toHaveLength(3)
  })

  test('respects limit option', async () => {
    for (let i = 0; i < 5; i++) {
      await logger.log(baseEntry({ action: `action-${i}` }))
    }

    const entries = await logger.read({ limit: 3 })
    expect(entries).toHaveLength(3)
    expect(entries[0].action).toBe('action-0')
    expect(entries[2].action).toBe('action-2')
  })

  test('respects offset option', async () => {
    for (let i = 0; i < 5; i++) {
      await logger.log(baseEntry({ action: `action-${i}` }))
    }

    const entries = await logger.read({ offset: 2 })
    expect(entries).toHaveLength(3)
    expect(entries[0].action).toBe('action-2')
    expect(entries[2].action).toBe('action-4')
  })

  test('respects combined limit and offset', async () => {
    for (let i = 0; i < 10; i++) {
      await logger.log(baseEntry({ action: `action-${i}` }))
    }

    const entries = await logger.read({ offset: 3, limit: 2 })
    expect(entries).toHaveLength(2)
    expect(entries[0].action).toBe('action-3')
    expect(entries[1].action).toBe('action-4')
  })

  test('offset beyond length returns empty array', async () => {
    await logger.log(baseEntry())

    const entries = await logger.read({ offset: 100 })
    expect(entries).toEqual([])
  })

  test('limit of 0 returns empty array', async () => {
    await logger.log(baseEntry())

    const entries = await logger.read({ limit: 0 })
    expect(entries).toEqual([])
  })
})

// ===========================================================================
// tail()
// ===========================================================================

describe('AuditLogger.tail', () => {
  test('returns last N entries', async () => {
    for (let i = 0; i < 5; i++) {
      await logger.log(baseEntry({ action: `action-${i}` }))
    }

    const entries = await logger.tail(2)
    expect(entries).toHaveLength(2)
    expect(entries[0].action).toBe('action-3')
    expect(entries[1].action).toBe('action-4')
  })

  test('returns all entries if N > total', async () => {
    await logger.log(baseEntry({ action: 'only' }))

    const entries = await logger.tail(100)
    expect(entries).toHaveLength(1)
    expect(entries[0].action).toBe('only')
  })

  test('returns empty array on empty log', async () => {
    const entries = await logger.tail(5)
    expect(entries).toEqual([])
  })

  test('tail(1) returns the last entry', async () => {
    await logger.log(baseEntry({ action: 'first' }))
    await logger.log(baseEntry({ action: 'last' }))

    const entries = await logger.tail(1)
    expect(entries).toHaveLength(1)
    expect(entries[0].action).toBe('last')
  })
})

// ===========================================================================
// Secret redaction
// ===========================================================================

describe('AuditLogger secret redaction', () => {
  test('redacts password in payload values', async () => {
    await logger.log(baseEntry({
      payload: { command: 'password= supersecret123' },
    }))

    const entries = await logger.read()
    expect(entries[0].payload.command).not.toContain('supersecret123')
    expect(entries[0].payload.command as string).toContain('[REDACTED]')
  })

  test('redacts token in payload values', async () => {
    await logger.log(baseEntry({
      payload: { command: 'token=abc123secret' },
    }))

    const entries = await logger.read()
    expect(entries[0].payload.command).not.toContain('abc123secret')
    expect(entries[0].payload.command as string).toContain('[REDACTED]')
  })

  test('redacts Bearer token in payload values', async () => {
    await logger.log(baseEntry({
      payload: { header: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9' },
    }))

    const entries = await logger.read()
    expect(entries[0].payload.header).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(entries[0].payload.header as string).toContain('[REDACTED]')
  })

  test('redacts API key patterns (sk-...)', async () => {
    await logger.log(baseEntry({
      payload: { key: 'Using key sk-abcdefghijklmnopqrstuvwxyz1234' },
    }))

    const entries = await logger.read()
    expect(entries[0].payload.key).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234')
    expect(entries[0].payload.key as string).toContain('[REDACTED]')
  })

  test('redacts GitHub personal access token (ghp_...)', async () => {
    await logger.log(baseEntry({
      payload: { token: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' },
    }))

    const entries = await logger.read()
    expect(entries[0].payload.token).not.toContain('ghp_ABCDEFGHIJKLMNOPQRST')
    expect(entries[0].payload.token as string).toContain('[REDACTED]')
  })

  test('redacts secrets in nested payload objects', async () => {
    await logger.log(baseEntry({
      payload: {
        outer: {
          command: 'password=mysecret',
        },
      },
    }))

    const entries = await logger.read()
    const outer = entries[0].payload.outer as Record<string, unknown>
    expect(outer.command).not.toContain('mysecret')
    expect(outer.command as string).toContain('[REDACTED]')
  })

  test('does not redact non-secret values', async () => {
    await logger.log(baseEntry({
      payload: { command: 'echo hello world', count: 42 },
    }))

    const entries = await logger.read()
    expect(entries[0].payload.command).toBe('echo hello world')
    expect(entries[0].payload.count).toBe(42)
  })

  test('redacts secret= pattern with colon separator', async () => {
    await logger.log(baseEntry({
      payload: { config: 'secret: myverysecretvalue' },
    }))

    const entries = await logger.read()
    expect(entries[0].payload.config).not.toContain('myverysecretvalue')
    expect(entries[0].payload.config as string).toContain('[REDACTED]')
  })
})
