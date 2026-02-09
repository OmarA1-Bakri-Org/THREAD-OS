import type { TemplateResult, TemplateOptions } from './index'
import { randomUUID } from 'crypto'

/**
 * Build a parallel execution template composed of worker steps.
 *
 * Creates a TemplateResult containing one worker step per computed worker count; each step references a prompt file, shares a common group id, and is configured with the chosen model, working directory (if provided) and fail policy.
 *
 * @param options - Template options; must include `baseName`. Optional fields:
 *   - `model`: model to assign to each worker (defaults to `claude-code`).
 *   - `cwd`: working directory path to include on each step.
 *   - `workerCount`: number of workers; fractional values are rounded down and the result is clamped to a minimum of 1 (default 3).
 *   - `failPolicy`: either `'fail_fast'` or `'best_effort'` (default `'fail_fast'`).
 * @returns The generated TemplateResult containing `steps` (an array of worker step objects) and an empty `gates` array.
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