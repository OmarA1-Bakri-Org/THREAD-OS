import type { Step } from '../sequence/schema'

export interface LongAutonomyTemplateOptions {
  prefix?: string
  model?: 'claude-code' | 'codex' | 'gemini'
  timeoutMs?: number
}

export function generateLongAutonomy(opts: LongAutonomyTemplateOptions = {}): Step[] {
  const prefix = opts.prefix || 'long'
  const model = opts.model || 'claude-code'
  const timeoutMs = opts.timeoutMs || 3600000 // 1 hour default

  const mainId = `${prefix}-main`
  const watchdogId = `${prefix}-watchdog`

  return [
    {
      id: mainId,
      name: `${prefix} main task`,
      type: 'l',
      model,
      prompt_file: `.threados/prompts/${mainId}.md`,
      depends_on: [],
      status: 'READY',
      timeout_ms: timeoutMs,
    },
    {
      id: watchdogId,
      name: `${prefix} watchdog`,
      type: 'l',
      model,
      prompt_file: `.threados/prompts/${watchdogId}.md`,
      depends_on: [],
      status: 'READY',
      watchdog_for: mainId,
      timeout_ms: timeoutMs,
    },
  ]
}
