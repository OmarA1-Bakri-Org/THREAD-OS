import type { TemplateResult, TemplateOptions } from './index'

export function generateFusionTemplate(options: TemplateOptions & { candidateModels?: Array<'claude-code' | 'codex' | 'gemini'> }): TemplateResult {
  const { baseName, model = 'claude-code', cwd, candidateModels = ['claude-code', 'codex', 'gemini'] } = options
  const steps = []
  const candidateIds: string[] = []

  for (const candidateModel of candidateModels) {
    const id = `${baseName}-${candidateModel}`
    candidateIds.push(id)
    steps.push({
      id,
      name: `${baseName} (${candidateModel})`,
      type: 'f' as const,
      model: candidateModel,
      prompt_file: `.threados/prompts/${id}.md`,
      depends_on: [],
      status: 'READY' as const,
      fusion_candidates: candidateIds.filter(c => c !== id),
      ...(cwd && { cwd }),
    })
  }

  // Update fusion_candidates to include all other candidates
  for (const step of steps) {
    step.fusion_candidates = candidateIds.filter(c => c !== step.id)
  }

  // Synth step
  const synthId = `${baseName}-synth`
  steps.push({
    id: synthId,
    name: `${baseName} Synthesis`,
    type: 'f' as const,
    model: model as 'claude-code' | 'codex' | 'gemini',
    prompt_file: `.threados/prompts/${synthId}.md`,
    depends_on: candidateIds,
    status: 'READY' as const,
    fusion_synth: true,
    fusion_candidates: candidateIds,
    ...(cwd && { cwd }),
  })

  return { steps, gates: [] }
}
