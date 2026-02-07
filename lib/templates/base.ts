import type { TemplateResult, TemplateOptions } from './index'

export function generateBaseTemplate(options: TemplateOptions): TemplateResult {
  const { baseName, model = 'claude-code', cwd } = options
  return {
    steps: [{
      id: baseName,
      name: baseName,
      type: 'base',
      model,
      prompt_file: `.threados/prompts/${baseName}.md`,
      depends_on: [],
      status: 'READY',
      ...(cwd && { cwd }),
    }],
    gates: [],
  }
}
