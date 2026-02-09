import type { TemplateResult, TemplateOptions } from './index'
import { randomUUID } from 'crypto'

export function generateParallelTemplate(options: TemplateOptions & { workerCount?: number; failPolicy?: 'fail_fast' | 'best_effort' }): TemplateResult {
  const { baseName, model = 'claude-code', cwd, workerCount: rawWorkerCount = 3, failPolicy = 'fail_fast' } = options
  const workerCount = Math.max(1, Math.floor(rawWorkerCount))
  const groupId = randomUUID().slice(0, 8)
  const steps = []

  for (let i = 1; i <= workerCount; i++) {
    const id = `${baseName}-worker-${i}`
    steps.push({
      id,
      name: `${baseName} Worker ${i}`,
      type: 'p' as const,
      model: model as 'claude-code' | 'codex' | 'gemini',
      prompt_file: `.threados/prompts/${id}.md`,
      depends_on: [],
      status: 'READY' as const,
      group_id: groupId,
      fanout: workerCount,
      fail_policy: failPolicy as 'fail_fast' | 'best_effort',
      ...(cwd && { cwd }),
    })
  }

  return { steps, gates: [] }
}
