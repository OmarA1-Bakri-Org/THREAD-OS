import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { createTempDir, cleanTempDir } from '../../test/helpers/setup'
import { writePrompt, readPrompt, listPrompts, deletePrompt, validatePromptExists } from './manager'

describe('prompts manager', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await createTempDir()
    await mkdir(join(tmpDir, '.threados/prompts'), { recursive: true })
  })

  afterEach(async () => {
    await cleanTempDir(tmpDir)
  })

  test('write and read prompt', async () => {
    await writePrompt(tmpDir, 'step-1', '# Hello\nDo stuff')
    const content = await readPrompt(tmpDir, 'step-1')
    expect(content).toBe('# Hello\nDo stuff')
  })

  test('list prompts', async () => {
    await writePrompt(tmpDir, 'a', 'content a')
    await writePrompt(tmpDir, 'b', 'content b')
    const list = await listPrompts(tmpDir)
    expect(list.sort()).toEqual(['a', 'b'])
  })

  test('list prompts on empty dir', async () => {
    const list = await listPrompts(tmpDir)
    expect(list).toEqual([])
  })

  test('validate exists', async () => {
    await writePrompt(tmpDir, 'exists', 'content')
    expect(await validatePromptExists(tmpDir, 'exists')).toBe(true)
    expect(await validatePromptExists(tmpDir, 'nope')).toBe(false)
  })

  test('delete prompt', async () => {
    await writePrompt(tmpDir, 'to-delete', 'content')
    await deletePrompt(tmpDir, 'to-delete')
    expect(await validatePromptExists(tmpDir, 'to-delete')).toBe(false)
  })
})
