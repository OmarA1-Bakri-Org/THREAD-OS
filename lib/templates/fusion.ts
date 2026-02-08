import type { Step } from '../sequence/schema'

export interface FusionTemplateOptions {
  prefix?: string
  candidateCount?: number
  model?: 'claude-code' | 'codex' | 'gemini'
}

export function generateFusion(opts: FusionTemplateOptions = {}): Step[] {
  const prefix = opts.prefix || 'fusion'
  const count = opts.candidateCount || 3
  const model = opts.model || 'claude-code'

  const steps: Step[] = []
  const candidateIds: string[] = []

  for (let i = 1; i <= count; i++) {
    const id = `${prefix}-candidate-${i}`
    candidateIds.push(id)
    steps.push({
      id,
      name: `${prefix} candidate ${i}`,
      type: 'f',
      model,
      prompt_file: `.threados/prompts/${id}.md`,
      depends_on: [],
      status: 'READY',
      fusion_candidates: true,
    })
  }

  const synthId = `${prefix}-synth`
  steps.push({
    id: synthId,
    name: `${prefix} synthesis`,
    type: 'f',
    model,
    prompt_file: `.threados/prompts/${synthId}.md`,
    depends_on: [...candidateIds],
    status: 'READY',
    fusion_synth: true,
  })

  return steps
}
