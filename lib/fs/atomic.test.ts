import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { writeFileAtomic } from './atomic'
import { createTempDir, cleanTempDir } from '../../test/helpers/setup'
import { readFile } from 'fs/promises'
import { join } from 'path'

let tempDir: string

beforeEach(async () => {
  tempDir = await createTempDir()
})

afterEach(async () => {
  await cleanTempDir(tempDir)
})

describe('writeFileAtomic', () => {
  test('writes file successfully', async () => {
    const filePath = join(tempDir, 'test.txt')
    await writeFileAtomic(filePath, 'hello world')
    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('hello world')
  })

  test('creates parent directories', async () => {
    const filePath = join(tempDir, 'nested', 'dir', 'test.txt')
    await writeFileAtomic(filePath, 'nested content')
    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('nested content')
  })

  test('overwrites existing file', async () => {
    const filePath = join(tempDir, 'test.txt')
    await writeFileAtomic(filePath, 'first')
    await writeFileAtomic(filePath, 'second')
    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('second')
  })
})
