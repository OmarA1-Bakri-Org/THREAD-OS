import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { writeFileAtomic } from './atomic'
import { mkdtemp, rm, readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'threados-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ===========================================================================
// writeFileAtomic
// ===========================================================================

describe('writeFileAtomic', () => {
  test('writes file successfully', async () => {
    const filePath = join(tmpDir, 'test.txt')
    await writeFileAtomic(filePath, 'hello world')

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('hello world')
  })

  test('file content is exactly what was written', async () => {
    const filePath = join(tmpDir, 'exact.txt')
    const longContent = 'Line 1\nLine 2\nLine 3\n' + 'x'.repeat(10000)
    await writeFileAtomic(filePath, longContent)

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe(longContent)
  })

  test('creates parent directories if they do not exist', async () => {
    const filePath = join(tmpDir, 'a', 'b', 'c', 'deep.txt')
    await writeFileAtomic(filePath, 'deep content')

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('deep content')
  })

  test('creates deeply nested parent directories', async () => {
    const filePath = join(tmpDir, 'level1', 'level2', 'level3', 'level4', 'file.txt')
    await writeFileAtomic(filePath, 'deep')

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('deep')
  })

  test('no temp files left on success', async () => {
    const filePath = join(tmpDir, 'clean.txt')
    await writeFileAtomic(filePath, 'content')

    const files = await readdir(tmpDir)
    // Only the target file should exist
    expect(files).toEqual(['clean.txt'])
    // No .tmp files
    const tmpFiles = files.filter(f => f.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  test('overwrites existing file', async () => {
    const filePath = join(tmpDir, 'overwrite.txt')
    await writeFileAtomic(filePath, 'first')
    await writeFileAtomic(filePath, 'second')

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('second')
  })

  test('handles empty content', async () => {
    const filePath = join(tmpDir, 'empty.txt')
    await writeFileAtomic(filePath, '')

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('')
  })

  test('handles content with unicode characters', async () => {
    const filePath = join(tmpDir, 'unicode.txt')
    const unicodeContent = 'Hello \u{1F600} World \u{1F30D} \u00E9\u00E8\u00EA \u4F60\u597D'
    await writeFileAtomic(filePath, unicodeContent)

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe(unicodeContent)
  })

  test('handles content with newlines and special characters', async () => {
    const filePath = join(tmpDir, 'special.txt')
    const content = 'line1\nline2\r\nline3\ttab\0null'
    await writeFileAtomic(filePath, content)

    const result = await readFile(filePath, 'utf-8')
    expect(result).toBe(content)
  })

  test('writes YAML content correctly', async () => {
    const filePath = join(tmpDir, 'test.yaml')
    const yaml = `version: "1.0"
name: test-sequence
steps:
  - id: step-1
    name: First Step
    type: base
`
    await writeFileAtomic(filePath, yaml)

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe(yaml)
  })

  test('no temp files left in subdirectory on success', async () => {
    const dir = join(tmpDir, 'subdir')
    const filePath = join(dir, 'data.json')
    await writeFileAtomic(filePath, '{"key": "value"}')

    const files = await readdir(dir)
    expect(files).toEqual(['data.json'])
    const tmpFiles = files.filter(f => f.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })

  test('multiple concurrent writes do not interfere', async () => {
    const promises = []
    for (let i = 0; i < 10; i++) {
      const filePath = join(tmpDir, `concurrent-${i}.txt`)
      promises.push(writeFileAtomic(filePath, `content-${i}`))
    }
    await Promise.all(promises)

    // Verify all files exist with correct content
    for (let i = 0; i < 10; i++) {
      const content = await readFile(join(tmpDir, `concurrent-${i}.txt`), 'utf-8')
      expect(content).toBe(`content-${i}`)
    }

    // Verify no temp files
    const files = await readdir(tmpDir)
    const tmpFiles = files.filter(f => f.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })
})
