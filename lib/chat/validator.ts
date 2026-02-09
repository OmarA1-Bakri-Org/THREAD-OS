import { readSequence, writeSequence } from '../sequence/parser'
import { PolicyEngine } from '../policy/engine'
import * as audit from '../audit/logger'
import YAML from 'yaml'
import { StepSchema, StepTypeSchema, ModelTypeSchema, StepStatusSchema, type Sequence } from '../sequence/schema'

export interface ProposedAction {
  command: string
  args: Record<string, string | string[] | boolean | number | undefined>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface DryRunResult {
  valid: boolean
  diff: string
  errors: string[]
}

export interface ApplyResult {
  success: boolean
  results: Array<{ action?: string; status?: string; error?: string }>
}

const VALID_COMMANDS = [
  'step add', 'step remove', 'step update',
  'run', 'stop', 'restart',
  'gate approve', 'gate block',
  'dep add', 'dep remove',
  'group create', 'fusion create',
]

/** Allowed fields for step update to prevent arbitrary field injection */
const ALLOWED_UPDATE_FIELDS = new Set([
  'id', 'name', 'type', 'model', 'prompt_file', 'depends_on',
  'status', 'cwd', 'group_id', 'fanout', 'fusion_candidates',
  'fusion_synth', 'watchdog_for', 'orchestrator', 'timeout_ms', 'fail_policy',
])

export class ActionValidator {
  constructor(private basePath: string) {}

  /**
   * Validate that actions reference valid seqctl commands
   */
  async validate(actions: ProposedAction[]): Promise<ValidationResult> {
    const errors: string[] = []

    for (const action of actions) {
      if (!VALID_COMMANDS.includes(action.command)) {
        errors.push(`Unknown command: ${action.command}`)
        continue
      }

      // Command-specific validation
      if (action.command === 'step add') {
        if (!action.args.id) errors.push('step add requires id')
        if (!action.args.name) errors.push('step add requires name')
        if (!action.args.type) errors.push('step add requires type')
        if (!action.args.model) errors.push('step add requires model')
        if (!action.args.prompt_file) errors.push('step add requires prompt_file')
      }

      if (action.command === 'step remove' && !action.args.id) {
        errors.push('step remove requires id')
      }

      if (action.command === 'step update' && !action.args.id) {
        errors.push('step update requires id')
      }

      if (action.command === 'dep add') {
        if (!action.args.from) errors.push('dep add requires from')
        if (!action.args.to) errors.push('dep add requires to')
      }

      if (action.command === 'dep remove') {
        if (!action.args.from) errors.push('dep remove requires from')
        if (!action.args.to) errors.push('dep remove requires to')
      }

      if (action.command === 'restart' && !action.args.step_id) {
        errors.push('restart requires step_id')
      }

      if ((action.command === 'gate approve' || action.command === 'gate block') && !action.args.id) {
        errors.push(`${action.command} requires id`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Execute actions against a copy of the sequence and compute a diff
   */
  async dryRun(actions: ProposedAction[]): Promise<DryRunResult> {
    const validation = await this.validate(actions)
    if (!validation.valid) {
      return { valid: false, diff: '', errors: validation.errors }
    }

    try {
      const original = await readSequence(this.basePath)
      const originalYaml = YAML.stringify(original, { indent: 2 })

      // Apply actions to a copy
      const modified = structuredClone(original)
      const errors: string[] = []

      for (const action of actions) {
        const err = applyAction(modified, action)
        if (err) errors.push(err)
      }

      if (errors.length > 0) {
        return { valid: false, diff: '', errors }
      }

      const modifiedYaml = YAML.stringify(modified, { indent: 2 })
      const diff = computeUnifiedDiff(originalYaml, modifiedYaml)

      return { valid: true, diff, errors: [] }
    } catch (error) {
      return { valid: false, diff: '', errors: [(error as Error).message] }
    }
  }

  /**
   * Apply actions for real with policy checks and audit logging
   */
  async apply(actions: ProposedAction[]): Promise<ApplyResult> {
    const validation = await this.validate(actions)
    if (!validation.valid) {
      return { success: false, results: validation.errors.map(e => ({ error: e })) }
    }

    const policy = await PolicyEngine.load(this.basePath)
    const results: Array<{ action?: string; status?: string; error?: string }> = []

    try {
      const sequence = await readSequence(this.basePath)

      for (const action of actions) {
        // Policy check for mutations
        const policyResult = policy.validate({
          type: 'run_command',
          command: action.command,
        })

        if (!policyResult.allowed) {
          results.push({ action: action.command, error: policyResult.reason })
          continue
        }

        const err = applyAction(sequence, action)
        if (err) {
          results.push({ action: action.command, error: err })
          continue
        }

        await audit.log(this.basePath, {
          timestamp: new Date().toISOString(),
          actor: 'chat-orchestrator',
          action: action.command,
          target: String(action.args.id || action.args.step_id || 'sequence'),
          payload: action.args,
          result: 'applied',
        })

        results.push({ action: action.command, status: 'applied' })
      }

      await writeSequence(this.basePath, sequence)
      return { success: true, results }
    } catch (error) {
      return { success: false, results: [{ error: (error as Error).message }] }
    }
  }
}

/**
 * Apply a single action to a sequence object (mutates in place).
 * Returns error string or null on success.
 */
function applyAction(seq: Sequence, action: ProposedAction): string | null {
  switch (action.command) {
    case 'step add': {
      if (seq.steps.find(s => s.id === action.args.id)) {
        return `Step ${action.args.id} already exists`
      }
      const newStep = {
        id: action.args.id,
        name: action.args.name,
        type: action.args.type || 'base',
        model: action.args.model || 'claude-code',
        prompt_file: action.args.prompt_file,
        depends_on: action.args.depends_on || [],
        status: 'READY',
      }
      // Validate through schema to prevent invalid data
      const parsed = StepSchema.safeParse(newStep)
      if (!parsed.success) {
        return `Invalid step: ${parsed.error.issues.map(i => i.message).join(', ')}`
      }
      seq.steps.push(parsed.data)
      return null
    }
    case 'step remove': {
      const idx = seq.steps.findIndex(s => s.id === action.args.id)
      if (idx === -1) return `Step ${action.args.id} not found`
      seq.steps.splice(idx, 1)
      // Remove from depends_on of other steps
      for (const s of seq.steps) {
        s.depends_on = s.depends_on.filter(d => d !== action.args.id)
      }
      return null
    }
    case 'step update': {
      const step = seq.steps.find(s => s.id === action.args.id)
      if (!step) return `Step ${action.args.id} not found`
      const { id: _id, ...updates } = action.args
      // Only allow known fields to be updated (prevent prototype pollution / field injection)
      for (const key of Object.keys(updates)) {
        if (!ALLOWED_UPDATE_FIELDS.has(key)) {
          return `Invalid update field: ${key}`
        }
      }
      // Validate enum fields if provided
      if (updates.type !== undefined) {
        const typeResult = StepTypeSchema.safeParse(updates.type)
        if (!typeResult.success) return `Invalid type: ${updates.type}`
        step.type = typeResult.data
      }
      if (updates.model !== undefined) {
        const modelResult = ModelTypeSchema.safeParse(updates.model)
        if (!modelResult.success) return `Invalid model: ${updates.model}`
        step.model = modelResult.data
      }
      if (updates.status !== undefined) {
        const statusResult = StepStatusSchema.safeParse(updates.status)
        if (!statusResult.success) return `Invalid status: ${updates.status}`
        step.status = statusResult.data
      }
      if (updates.name !== undefined) step.name = String(updates.name)
      if (updates.prompt_file !== undefined) step.prompt_file = String(updates.prompt_file)
      if (updates.cwd !== undefined) step.cwd = String(updates.cwd)
      if (updates.depends_on !== undefined && Array.isArray(updates.depends_on)) {
        step.depends_on = updates.depends_on.map(String)
      }
      return null
    }
    case 'dep add': {
      const step = seq.steps.find(s => s.id === action.args.from)
      if (!step) return `Step ${action.args.from} not found`
      if (!step.depends_on.includes(String(action.args.to))) {
        step.depends_on.push(String(action.args.to))
      }
      return null
    }
    case 'dep remove': {
      const step = seq.steps.find(s => s.id === action.args.from)
      if (!step) return `Step ${action.args.from} not found`
      step.depends_on = step.depends_on.filter(d => d !== action.args.to)
      return null
    }
    case 'gate approve': {
      const gate = seq.gates.find(g => g.id === action.args.id)
      if (!gate) return `Gate ${action.args.id} not found`
      gate.status = 'APPROVED'
      return null
    }
    case 'gate block': {
      const gate = seq.gates.find(g => g.id === action.args.id)
      if (!gate) return `Gate ${action.args.id} not found`
      gate.status = 'BLOCKED'
      return null
    }
    case 'run':
    case 'stop':
    case 'restart':
    case 'group create':
    case 'fusion create':
      // These are runtime commands, no-op in dry-run context
      return null
    default:
      return `Unknown command: ${action.command}`
  }
}

/**
 * Simple unified diff between two strings
 */
function computeUnifiedDiff(a: string, b: string): string {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const lines: string[] = ['--- original', '+++ modified']

  const maxLen = Math.max(aLines.length, bLines.length)
  for (let i = 0; i < maxLen; i++) {
    const aLine = aLines[i]
    const bLine = bLines[i]
    if (aLine === bLine) {
      lines.push(` ${aLine ?? ''}`)
    } else {
      if (aLine !== undefined) lines.push(`-${aLine}`)
      if (bLine !== undefined) lines.push(`+${bLine}`)
    }
  }

  return lines.join('\n')
}
