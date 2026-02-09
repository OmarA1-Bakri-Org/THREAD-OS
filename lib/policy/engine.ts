import { readFile } from 'fs/promises'
import { join, resolve, relative, sep } from 'path'
import YAML from 'yaml'
import { PolicyFileSchema, type PolicyFile } from './schema'
import type { PolicyMode } from '../sequence/schema'

const POLICY_PATH = '.threados/policy.yaml'

export interface PolicyAction {
  type: string        // e.g. 'step.add', 'run.step', 'gate.approve'
  command?: string    // The command to be executed (for runner steps)
  cwd?: string        // Working directory
  fanout?: number     // P-thread fanout count
  concurrent?: number // Current number of running steps
}

export interface PolicyResult {
  allowed: boolean
  reason?: string
  confirmation_required: boolean
}

export class PolicyEngine {
  private policy: PolicyFile
  private basePath: string

  constructor(basePath: string, policy?: PolicyFile) {
    this.basePath = basePath
    this.policy = policy ?? PolicyFileSchema.parse({})
  }

  static async load(basePath: string): Promise<PolicyEngine> {
    const policyPath = join(basePath, POLICY_PATH)
    try {
      const content = await readFile(policyPath, 'utf-8')
      const raw = YAML.parse(content)
      const policy = PolicyFileSchema.parse(raw)
      return new PolicyEngine(basePath, policy)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new PolicyEngine(basePath)
      }
      throw error
    }
  }

  getMode(): PolicyMode {
    return this.policy.mode
  }

  setMode(mode: PolicyMode): void {
    this.policy.mode = mode
  }

  getPolicy(): PolicyFile {
    return { ...this.policy }
  }

  validate(action: PolicyAction): PolicyResult {
    // Check command allowlist
    if (action.command) {
      const commandBase = action.command.split(/\s+/)[0]
      if (this.policy.allowed_commands.length > 0) {
        const allowed = this.policy.allowed_commands.some(
          cmd => commandBase === cmd || commandBase.endsWith('/' + cmd) || commandBase.endsWith('\\' + cmd)
        )
        if (!allowed) {
          return {
            allowed: false,
            reason: `Command '${commandBase}' is not in the allowed commands list`,
            confirmation_required: false,
          }
        }
      }
    }

    // Check forbidden patterns
    if (action.command) {
      for (const pattern of this.policy.forbidden_patterns) {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(action.command)) {
          return {
            allowed: false,
            reason: `Command matches forbidden pattern: ${pattern}`,
            confirmation_required: false,
          }
        }
      }
    }

    // Check CWD restriction
    if (action.cwd && this.policy.allowed_cwd.length > 0) {
      const cwdResolved = resolve(this.basePath, action.cwd)
      const isAllowed = this.policy.allowed_cwd.some(pattern => {
        if (pattern === './**') return true
        const root = resolve(this.basePath, pattern.replace(/\/\*\*$/, ''))
        const rel = relative(root, cwdResolved)
        return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..')
      })
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Working directory '${action.cwd}' is not in allowed paths`,
          confirmation_required: false,
        }
      }
    }

    // Check fanout limit
    if (action.fanout !== undefined && action.fanout > this.policy.max_fanout) {
      return {
        allowed: false,
        reason: `Fanout ${action.fanout} exceeds maximum ${this.policy.max_fanout}`,
        confirmation_required: false,
      }
    }

    // Check concurrent limit
    if (action.concurrent !== undefined && action.concurrent >= this.policy.max_concurrent) {
      return {
        allowed: false,
        reason: `Concurrent processes ${action.concurrent} would exceed maximum ${this.policy.max_concurrent}`,
        confirmation_required: false,
      }
    }

    // Check if confirmation is required
    const needsConfirmation = this.policy.confirmation_required.includes(action.type) ||
      (this.policy.mode === 'SAFE' && action.type.startsWith('run.'))

    return {
      allowed: true,
      confirmation_required: needsConfirmation,
    }
  }
}
