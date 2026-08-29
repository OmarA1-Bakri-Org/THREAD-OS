import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { resolveComposioCli } from './environment-preflight'

const cleanup: string[] = []
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Composio runtime preflight resolution', () => {
  test('uses the executable discovered by which when available', async () => {
    const root = await mkdtemp(join(tmpdir(), 'threados-composio-which-'))
    cleanup.push(root)
    const executable = join(root, 'composio')
    await writeFile(executable, 'stub', 'utf-8')
    await chmod(executable, 0o755)
    await expect(resolveComposioCli({ home: root, which: () => executable })).resolves.toBe(executable)
  })

  test('falls back to ~/.composio/composio when it is executable', async () => {
    const home = await mkdtemp(join(tmpdir(), 'threados-composio-home-'))
    cleanup.push(home)
    const executable = join(home, '.composio', 'composio')
    await mkdir(join(home, '.composio'), { recursive: true })
    await writeFile(executable, 'stub', 'utf-8')
    await chmod(executable, 0o755)
    await expect(resolveComposioCli({ home, which: () => null })).resolves.toBe(executable)
  })
})
