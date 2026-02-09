import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { createTempDir, cleanTempDir } from '../../test/helpers/setup'
import { readMprocsMap, writeMprocsMap, updateStepProcess, removeStepProcess } from './state'

describe('mprocs state', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await createTempDir()
    await mkdir(join(tmpDir, '.threados/state'), { recursive: true })
  })

  afterEach(async () => {
    await cleanTempDir(tmpDir)
  })

  test('missing file returns empty map', async () => {
    const map = await readMprocsMap(tmpDir)
    expect(map).toEqual({})
  })

  test('write then read', async () => {
    const data = { 'step-1': 0, 'step-2': 1 }
    await writeMprocsMap(tmpDir, data)
    const result = await readMprocsMap(tmpDir)
    expect(result).toEqual(data)
  })

  test('updateStepProcess adds entry', async () => {
    await updateStepProcess(tmpDir, 'step-a', 3)
    const map = await readMprocsMap(tmpDir)
    expect(map['step-a']).toBe(3)
  })

  test('updateStepProcess updates existing', async () => {
    await updateStepProcess(tmpDir, 'step-a', 0)
    await updateStepProcess(tmpDir, 'step-a', 5)
    const map = await readMprocsMap(tmpDir)
    expect(map['step-a']).toBe(5)
  })

  test('removeStepProcess removes entry', async () => {
    await writeMprocsMap(tmpDir, { 'step-a': 0, 'step-b': 1 })
    await removeStepProcess(tmpDir, 'step-a')
    const map = await readMprocsMap(tmpDir)
    expect(map['step-a']).toBeUndefined()
    expect(map['step-b']).toBe(1)
  })
})
