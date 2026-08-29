import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, symlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { resolveWritablePathWithinBase } from './path-safety'

let basePath = ''
let outsidePath = ''
beforeEach(async () => {
  basePath = await mkdtemp(join(tmpdir(), 'threados-path-base-'))
  outsidePath = await mkdtemp(join(tmpdir(), 'threados-path-outside-'))
})
afterEach(async () => {
  await rm(basePath, { recursive: true, force: true })
  await rm(outsidePath, { recursive: true, force: true })
})

describe('writable path containment', () => {
  test('rejects a non-existent write target beneath a symlinked parent outside the workspace', async () => {
    const linkPath = join(basePath, 'linked-outside')
    await symlink(outsidePath, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
    await expect(resolveWritablePathWithinBase(basePath, 'linked-outside/escape.txt', 'write target')).rejects.toThrow('within the workspace')
  })

  test('allows a non-existent write target beneath a real workspace directory', async () => {
    await expect(resolveWritablePathWithinBase(basePath, 'nested/new.txt', 'write target')).resolves.toBe(join(basePath, 'nested', 'new.txt'))
  })
})
