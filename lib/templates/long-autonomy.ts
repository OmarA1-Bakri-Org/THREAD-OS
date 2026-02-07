import type { TemplateResult, TemplateOptions } from './index'

export function generateLongAutonomyTemplate(options: TemplateOptions & { timeoutMs?: number; includeWatchdog?: boolean }): TemplateResult {
  const { baseName, model = 'claude-code', cwd, timeoutMs = 7200000, includeWatchdog = true } = options
  const steps = []

  const mainId = `${baseName}-main`
  steps.push({
    id: mainId,
    name: `${baseName} (Long Run)`,
    type: 'l' as const,
    model: model as 'claude-code' | 'codex' | 'gemini',
    prompt_file: `.threados/prompts/${mainId}.md`,
    depends_on: [],
    status: 'READY' as const,
    timeout_ms: timeoutMs,
    ...(cwd && { cwd }),
  })

  if (includeWatchdog) {
    const watchdogId = `${baseName}-watchdog`
    steps.push({
      id: watchdogId,
      name: `${baseName} Watchdog`,
      type: 'l' as const,
      model: model as 'claude-code' | 'codex' | 'gemini',
      prompt_file: `.threados/prompts/${watchdogId}.md`,
      depends_on: [],
      status: 'READY' as const,
      watchdog_for: mainId,
      ...(cwd && { cwd }),
    })
  }

  return { steps, gates: [] }
}
