import type { TemplateResult, TemplateOptions } from './index'

export function generateOrchestratedTemplate(options: TemplateOptions): TemplateResult {
  const { baseName, model = 'claude-code', cwd } = options

  return {
    steps: [{
      id: `${baseName}-orchestrator`,
      name: `${baseName} Orchestrator`,
      type: 'b' as const,
      model: model as 'claude-code' | 'codex' | 'gemini',
      prompt_file: `.threados/prompts/${baseName}-orchestrator.md`,
      depends_on: [],
      status: 'READY' as const,
      orchestrator: true,
      ...(cwd && { cwd }),
    }],
    gates: [],
  }
}
