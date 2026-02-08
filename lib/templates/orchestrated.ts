import type { Step } from '../sequence/schema'

export interface OrchestratedTemplateOptions {
  prefix?: string
  workerCount?: number
  model?: 'claude-code' | 'codex' | 'gemini'
}

export function generateOrchestrated(opts: OrchestratedTemplateOptions = {}): Step[] {
  const prefix = opts.prefix || 'orch'
  const workerCount = opts.workerCount || 3
  const model = opts.model || 'claude-code'

  const orchestratorId = `${prefix}-orchestrator`
  const steps: Step[] = []

  steps.push({
    id: orchestratorId,
    name: `${prefix} orchestrator`,
    type: 'b',
    model,
    prompt_file: `.threados/prompts/${orchestratorId}.md`,
    depends_on: [],
    status: 'READY',
    orchestrator: orchestratorId,
  })

  for (let i = 1; i <= workerCount; i++) {
    const id = `${prefix}-worker-${i}`
    steps.push({
      id,
      name: `${prefix} worker ${i}`,
      type: 'b',
      model,
      prompt_file: `.threados/prompts/${id}.md`,
      depends_on: [orchestratorId],
      status: 'READY',
      orchestrator: orchestratorId,
    })
  }

  return steps
}
