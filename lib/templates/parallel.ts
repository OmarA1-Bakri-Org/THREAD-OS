import { randomUUID } from 'crypto'
import type { Step } from '../sequence/schema'

export interface ParallelTemplateOptions {
  prefix?: string
  count?: number
  model?: 'claude-code' | 'codex' | 'gemini'
}

export function generateParallel(opts: ParallelTemplateOptions = {}): Step[] {
  const prefix = opts.prefix || 'parallel'
  const count = opts.count || 3
  const model = opts.model || 'claude-code'
  const groupId = `group-${randomUUID().slice(0, 8)}`

  const steps: Step[] = []
  for (let i = 1; i <= count; i++) {
    const id = `${prefix}-${i}`
    steps.push({
      id,
      name: `${prefix} ${i}`,
      type: 'p',
      model,
      prompt_file: `.threados/prompts/${id}.md`,
      depends_on: [],
      status: 'READY',
      group_id: groupId,
    })
  }
  return steps
}
