import { generateBaseTemplate } from './base'
import { generateParallelTemplate } from './parallel'
import { generateChainedTemplate } from './chained'
import { generateFusionTemplate } from './fusion'
import { generateOrchestratedTemplate } from './orchestrated'
import { generateLongAutonomyTemplate } from './long-autonomy'
import type { Step, Gate } from '../sequence/schema'

export interface TemplateResult {
  steps: Step[]
  gates: Gate[]
}

export interface TemplateOptions {
  baseName: string
  model?: 'claude-code' | 'codex' | 'gemini'
  cwd?: string
  [key: string]: unknown
}

export type TemplateType = 'base' | 'parallel' | 'chained' | 'fusion' | 'orchestrated' | 'long-autonomy'

const generators: Record<TemplateType, (options: TemplateOptions) => TemplateResult> = {
  base: generateBaseTemplate,
  parallel: generateParallelTemplate,
  chained: generateChainedTemplate,
  fusion: generateFusionTemplate,
  orchestrated: generateOrchestratedTemplate,
  'long-autonomy': generateLongAutonomyTemplate,
}

export function generateTemplate(type: TemplateType, options: TemplateOptions): TemplateResult {
  const generator = generators[type]
  if (!generator) {
    throw new Error(`Unknown template type: ${type}`)
  }
  return generator(options)
}

export { generateBaseTemplate } from './base'
export { generateParallelTemplate } from './parallel'
export { generateChainedTemplate } from './chained'
export { generateFusionTemplate } from './fusion'
export { generateOrchestratedTemplate } from './orchestrated'
export { generateLongAutonomyTemplate } from './long-autonomy'
