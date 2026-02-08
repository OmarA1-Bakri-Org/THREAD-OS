import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import YAML from 'yaml'
import type { Sequence } from '../../lib/sequence/schema'

export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'threados-test-'))
}

export async function cleanTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

export function makeSequence(overrides: Partial<Sequence> = {}): Sequence {
  return {
    version: '1.0',
    name: 'test-sequence',
    steps: [],
    gates: [],
    ...overrides,
  }
}

export async function writeTestSequence(basePath: string, seq: Sequence): Promise<void> {
  const dir = join(basePath, '.threados')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'sequence.yaml'), YAML.stringify(seq), 'utf-8')
}

export function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-step',
    name: 'Test Step',
    type: 'base' as const,
    model: 'claude-code' as const,
    prompt_file: '.threados/prompts/test.md',
    depends_on: [],
    status: 'READY' as const,
    ...overrides,
  }
}
