import type { Step } from '../sequence/schema'

export interface BaseTemplateOptions {
  prefix?: string
  count?: number
  model?: 'claude-code' | 'codex' | 'gemini'
}

export function generateBase(opts: BaseTemplateOptions = {}): Step[] {
  const prefix = opts.prefix || 'step'
  const count = opts.count || 1
  const model = opts.model || 'claude-code'

  const steps: Step[] = []
  for (let i = 1; i <= count; i++) {
    const id = `${prefix}-${i}`
    steps.push({
      id,
      name: `${prefix} ${i}`,
      type: 'base',
      model,
      prompt_file: `.threados/prompts/${id}.md`,
      depends_on: i > 1 ? [`${prefix}-${i - 1}`] : [],
      status: 'READY',
    })
  }
  return steps
}
