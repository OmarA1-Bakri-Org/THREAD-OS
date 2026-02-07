import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { readSequence, writeSequence } from './parser'
import { SequenceValidationError } from '../errors'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Sequence } from './schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'threados-test-'))
  await mkdir(join(tmpDir, '.threados'), { recursive: true })
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

function validSequence(): Sequence {
  return {
    version: '1.0',
    name: 'test-sequence',
    steps: [
      {
        id: 'step-a',
        name: 'Step A',
        type: 'base',
        model: 'claude-code',
        prompt_file: 'prompts/a.md',
        depends_on: [],
        status: 'READY',
      },
    ],
    gates: [],
  }
}

// ===========================================================================
// readSequence
// ===========================================================================

describe('readSequence', () => {
  test('reads and validates a correct YAML file', async () => {
    const yamlContent = `
name: test-sequence
version: "1.0"
steps:
  - id: step-a
    name: Step A
    type: base
    model: claude-code
    prompt_file: prompts/a.md
gates: []
`
    await writeFile(join(tmpDir, '.threados/sequence.yaml'), yamlContent, 'utf-8')

    const seq = await readSequence(tmpDir)
    expect(seq.name).toBe('test-sequence')
    expect(seq.version).toBe('1.0')
    expect(seq.steps).toHaveLength(1)
    expect(seq.steps[0].id).toBe('step-a')
    expect(seq.steps[0].status).toBe('READY') // default applied
    expect(seq.steps[0].depends_on).toEqual([]) // default applied
  })

  test('throws on missing file', async () => {
    // No sequence.yaml exists in tmpDir
    const emptyDir = await mkdtemp(join(tmpdir(), 'threados-test-empty-'))
    try {
      await expect(readSequence(emptyDir)).rejects.toThrow()
    } finally {
      await rm(emptyDir, { recursive: true, force: true })
    }
  })

  test('throws SequenceValidationError on invalid data', async () => {
    // Missing required 'name' field
    const yamlContent = `
version: "1.0"
steps: []
`
    await writeFile(join(tmpDir, '.threados/sequence.yaml'), yamlContent, 'utf-8')

    await expect(readSequence(tmpDir)).rejects.toThrow(SequenceValidationError)
  })

  test('throws on malformed YAML', async () => {
    const malformed = `
name: test
steps:
  - id: "unclosed
    bad yaml: [
`
    await writeFile(join(tmpDir, '.threados/sequence.yaml'), malformed, 'utf-8')

    await expect(readSequence(tmpDir)).rejects.toThrow()
  })

  test('throws SequenceValidationError when step has invalid ID', async () => {
    const yamlContent = `
name: test-sequence
steps:
  - id: UPPERCASE
    name: Bad
    type: base
    model: claude-code
    prompt_file: x.md
`
    await writeFile(join(tmpDir, '.threados/sequence.yaml'), yamlContent, 'utf-8')

    await expect(readSequence(tmpDir)).rejects.toThrow(SequenceValidationError)
  })

  test('applies defaults for omitted fields', async () => {
    const yamlContent = `
name: defaults-test
steps:
  - id: s1
    name: S1
    type: base
    model: claude-code
    prompt_file: p.md
`
    await writeFile(join(tmpDir, '.threados/sequence.yaml'), yamlContent, 'utf-8')

    const seq = await readSequence(tmpDir)
    expect(seq.version).toBe('1.0')
    expect(seq.steps[0].status).toBe('READY')
    expect(seq.steps[0].depends_on).toEqual([])
    expect(seq.gates).toEqual([])
  })
})

// ===========================================================================
// writeSequence
// ===========================================================================

describe('writeSequence', () => {
  test('writes a valid sequence and creates directories', async () => {
    const freshDir = await mkdtemp(join(tmpdir(), 'threados-test-write-'))
    try {
      // .threados directory does NOT exist yet; writeSequence should create it
      await writeSequence(freshDir, validSequence())

      // Now read it back
      const seq = await readSequence(freshDir)
      expect(seq.name).toBe('test-sequence')
      expect(seq.steps).toHaveLength(1)
      expect(seq.steps[0].id).toBe('step-a')
    } finally {
      await rm(freshDir, { recursive: true, force: true })
    }
  })

  test('validates before writing and rejects invalid sequence', async () => {
    const invalid = { version: '1.0', name: '', steps: [], gates: [] } as unknown as Sequence
    await expect(writeSequence(tmpDir, invalid)).rejects.toThrow(SequenceValidationError)
  })

  test('round-trip: write then read returns equivalent data', async () => {
    const original = validSequence()
    await writeSequence(tmpDir, original)
    const loaded = await readSequence(tmpDir)

    expect(loaded.name).toBe(original.name)
    expect(loaded.version).toBe(original.version)
    expect(loaded.steps).toHaveLength(original.steps.length)
    expect(loaded.steps[0].id).toBe(original.steps[0].id)
    expect(loaded.steps[0].name).toBe(original.steps[0].name)
    expect(loaded.steps[0].type).toBe(original.steps[0].type)
    expect(loaded.steps[0].model).toBe(original.steps[0].model)
    expect(loaded.steps[0].prompt_file).toBe(original.steps[0].prompt_file)
    expect(loaded.steps[0].status).toBe(original.steps[0].status)
    expect(loaded.steps[0].depends_on).toEqual(original.steps[0].depends_on)
    expect(loaded.gates).toEqual(original.gates)
  })

  test('round-trip with gates and metadata', async () => {
    const seq: Sequence = {
      ...validSequence(),
      gates: [
        { id: 'gate-1', name: 'Review', depends_on: ['step-a'], status: 'PENDING' },
      ],
      metadata: {
        created_by: 'alice',
        description: 'Integration test',
      },
    }

    await writeSequence(tmpDir, seq)
    const loaded = await readSequence(tmpDir)

    expect(loaded.gates).toHaveLength(1)
    expect(loaded.gates[0].id).toBe('gate-1')
    expect(loaded.gates[0].status).toBe('PENDING')
    expect(loaded.metadata?.created_by).toBe('alice')
    expect(loaded.metadata?.description).toBe('Integration test')
  })

  test('overwrites existing sequence file', async () => {
    const seq1 = validSequence()
    await writeSequence(tmpDir, seq1)

    const seq2: Sequence = { ...validSequence(), name: 'updated-sequence' }
    await writeSequence(tmpDir, seq2)

    const loaded = await readSequence(tmpDir)
    expect(loaded.name).toBe('updated-sequence')
  })
})
