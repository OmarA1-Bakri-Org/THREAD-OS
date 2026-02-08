import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { createTempDir, cleanTempDir } from '../../test/helpers/setup'
import { log, read, tail, redactSecrets } from './logger'
import type { AuditEntry } from './schema'

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    actor: 'test-user',
    action: 'test-action',
    target: 'test-target',
    result: 'success',
    ...overrides,
  }
}

describe('audit logger', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await createTempDir()
    await mkdir(join(tmpDir, '.threados'), { recursive: true })
  })

  afterEach(async () => {
    await cleanTempDir(tmpDir)
  })

  test('write and read entry', async () => {
    await log(tmpDir, makeEntry())
    const entries = await read(tmpDir)
    expect(entries).toHaveLength(1)
    expect(entries[0].actor).toBe('test-user')
  })

  test('multiple entries', async () => {
    await log(tmpDir, makeEntry({ action: 'a1' }))
    await log(tmpDir, makeEntry({ action: 'a2' }))
    await log(tmpDir, makeEntry({ action: 'a3' }))
    const entries = await read(tmpDir)
    expect(entries).toHaveLength(3)
  })

  test('read with pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await log(tmpDir, makeEntry({ action: `action-${i}` }))
    }
    const page = await read(tmpDir, { offset: 1, limit: 2 })
    expect(page).toHaveLength(2)
    expect(page[0].action).toBe('action-1')
    expect(page[1].action).toBe('action-2')
  })

  test('tail returns last n entries', async () => {
    for (let i = 0; i < 5; i++) {
      await log(tmpDir, makeEntry({ action: `action-${i}` }))
    }
    const last2 = await tail(tmpDir, 2)
    expect(last2).toHaveLength(2)
    expect(last2[0].action).toBe('action-3')
    expect(last2[1].action).toBe('action-4')
  })

  test('read from nonexistent file returns empty', async () => {
    const entries = await read(tmpDir)
    expect(entries).toEqual([])
  })

  test('tail from nonexistent file returns empty', async () => {
    const entries = await tail(tmpDir, 5)
    expect(entries).toEqual([])
  })

  test('secrets redaction in payload', async () => {
    await log(tmpDir, makeEntry({
      payload: { cmd: 'deploy --token=abc123 --password=secret123' },
    }))
    const entries = await read(tmpDir)
    const cmd = (entries[0].payload as Record<string, string>).cmd
    expect(cmd).toContain('token=[REDACTED]')
    expect(cmd).toContain('password=[REDACTED]')
    expect(cmd).not.toContain('abc123')
  })
})

describe('redactSecrets', () => {
  test('redacts password', () => {
    expect(redactSecrets('password=abc123')).toBe('password=[REDACTED]')
  })

  test('redacts token', () => {
    expect(redactSecrets('token=xyz')).toBe('token=[REDACTED]')
  })

  test('redacts key', () => {
    expect(redactSecrets('key=val')).toBe('key=[REDACTED]')
  })

  test('redacts secret', () => {
    expect(redactSecrets('secret=val')).toBe('secret=[REDACTED]')
  })

  test('preserves non-secret text', () => {
    expect(redactSecrets('hello world')).toBe('hello world')
  })

  test('case insensitive', () => {
    expect(redactSecrets('TOKEN=abc')).toBe('TOKEN=[REDACTED]')
  })
})
