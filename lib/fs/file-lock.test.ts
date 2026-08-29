import { describe, expect, test } from 'bun:test'
import { mkdir, utimes } from 'fs/promises'
import { join } from 'path'
import { lock } from 'proper-lockfile'
import { createTempDir, cleanTempDir } from '../../test/helpers/setup'
import { withFileLock } from './file-lock'

describe('withFileLock', () => {
  test('recovers a stale lock directory through the lock provider', async () => {
    const basePath = await createTempDir()
    try {
      const target = join(basePath, 'state', 'resource')
      const staleLock = `${target}.lock`
      await mkdir(staleLock, { recursive: true })
      const stale = new Date('2020-01-01T00:00:00.000Z')
      await utimes(staleLock, stale, stale)
      await expect(withFileLock(target, async () => 'ok', { retries: 0 })).resolves.toBe('ok')
    } finally {
      await cleanTempDir(basePath)
    }
  })

  test('does not steal an active lock', async () => {
    const basePath = await createTempDir()
    try {
      const target = join(basePath, 'state', 'resource')
      await mkdir(join(basePath, 'state'), { recursive: true })
      const release = await lock(target, { realpath: false, stale: 30_000, update: 10_000 })
      try {
        await expect(withFileLock(target, async () => 'nope', { label: 'test lock', retries: 0 }))
          .rejects.toThrow('Timed out acquiring test lock')
      } finally {
        await release()
      }
    } finally {
      await cleanTempDir(basePath)
    }
  })

  test('propagates EEXIST raised by protected work instead of treating it as contention', async () => {
    const basePath = await createTempDir()
    try {
      const inner = Object.assign(new Error('inner EEXIST'), { code: 'EEXIST' })
      await expect(withFileLock(join(basePath, 'state', 'resource'), async () => { throw inner }, { retries: 0 }))
        .rejects.toBe(inner)
    } finally {
      await cleanTempDir(basePath)
    }
  })
})
