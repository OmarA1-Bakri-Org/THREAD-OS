import type { TemplateResult, TemplateOptions } from './index'

export function generateChainedTemplate(options: TemplateOptions & { phaseCount?: number }): TemplateResult {
  const { baseName, model = 'claude-code', cwd, phaseCount = 3 } = options
  const steps = []
  const gates = []

  for (let i = 1; i <= phaseCount; i++) {
    const stepId = `${baseName}-phase-${i}`
    const depends_on: string[] = []

    if (i > 1) {
      depends_on.push(`${baseName}-gate-${i - 1}`)
    }

    steps.push({
      id: stepId,
      name: `${baseName} Phase ${i}`,
      type: 'c' as const,
      model: model as 'claude-code' | 'codex' | 'gemini',
      prompt_file: `.threados/prompts/${stepId}.md`,
      depends_on,
      status: (i === 1 ? 'READY' : 'BLOCKED') as 'READY' | 'BLOCKED',
      ...(cwd && { cwd }),
    })

    if (i < phaseCount) {
      const gateId = `${baseName}-gate-${i}`
      gates.push({
        id: gateId,
        name: `${baseName} Gate ${i}`,
        depends_on: [stepId],
        status: 'PENDING' as const,
      })
    }
  }

  return { steps, gates }
}
