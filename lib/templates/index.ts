export { generateBase } from './base'
export { generateParallel } from './parallel'
export { generateChained } from './chained'
export { generateFusion } from './fusion'
export { generateOrchestrated } from './orchestrated'
export { generateLongAutonomy } from './long-autonomy'

export const TEMPLATE_TYPES = ['base', 'parallel', 'chained', 'fusion', 'orchestrated', 'long-autonomy'] as const
export type TemplateType = typeof TEMPLATE_TYPES[number]
