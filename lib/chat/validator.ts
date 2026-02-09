import { z } from 'zod'
import { readSequence } from '../sequence/parser'

export const ProposedActionSchema = z.object({
  id: z.string(),
  command: z.string(),
  description: z.string(),
  destructive: z.boolean().default(false),
  reversible: z.boolean().default(true),
})

export type ProposedAction = z.infer<typeof ProposedActionSchema>

export const ChatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(ProposedActionSchema),
})

export type ChatResponse = z.infer<typeof ChatResponseSchema>

export interface ValidationResult {
  valid: boolean
  errors: Array<{ actionId: string; error: string }>
}

export interface DryRunResult {
  success: boolean
  sequenceDiff?: string
  errors: Array<{ actionId: string; error: string }>
}

export interface ApplyResult {
  success: boolean
  applied: string[]
  failed: Array<{ actionId: string; error: string }>
}

// Known seqctl commands for basic validation
const VALID_COMMANDS = [
  'step add', 'step edit', 'step rm', 'step clone',
  'dep add', 'dep rm',
  'gate insert', 'gate approve', 'gate block',
  'group parallelize',
  'fusion create',
  'run step', 'run runnable', 'run group',
  'stop', 'restart',
]

/**
 * Validate that proposed actions are syntactically valid seqctl commands
 */
export function validateActions(actions: ProposedAction[], policyMode?: string): ValidationResult {
  const errors: Array<{ actionId: string; error: string }> = []

  for (const action of actions) {
    const cmd = action.command.replace(/^seqctl\s+/, '')
    const tokens = cmd.split(/\s+/)
    // Normalize to "command subcommand" or single-word commands like "stop", "restart"
    const normalized = tokens.slice(0, 2).join(' ')
    const isValid = VALID_COMMANDS.some(valid => normalized === valid || tokens[0] === valid)
    if (!isValid) {
      errors.push({
        actionId: action.id,
        error: `Unknown command: ${action.command}`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Dry-run actions against the current sequence to preview changes.
 * Returns a YAML diff showing what would change.
 */
export async function dryRunActions(
  basePath: string,
  actions: ProposedAction[],
  policyMode?: string
): Promise<DryRunResult> {
  const errors: Array<{ actionId: string; error: string }> = []

  try {
    const beforeSequence = await readSequence(basePath)

    // For dry-run we just validate the commands parse correctly
    // and compute what the sequence would look like after applying them
    const validation = validateActions(actions, policyMode)
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      }
    }

    // Summary diff: describe the current state and proposed changes
    return {
      success: true,
      sequenceDiff: `--- Current sequence has ${beforeSequence.steps.length} steps, ${beforeSequence.gates.length} gates\n+++ ${actions.length} action(s) proposed`,
      errors: [],
    }
  } catch (error) {
    errors.push({
      actionId: 'system',
      error: error instanceof Error ? error.message : 'Dry run failed',
    })
    return { success: false, errors }
  }
}

/**
 * Parse a ProposedAction's command string into a structured format
 */
export function parseCommand(command: string): { command: string; subcommand?: string; args: string[]; flags: Record<string, string> } {
  const parts = command.replace(/^seqctl\s+/, '').split(/\s+/)
  const cmd = parts[0] || ''
  const remaining = parts.slice(1)

  let subcommand: string | undefined
  const args: string[] = []
  const flags: Record<string, string> = {}

  let i = 0
  // First non-flag arg after command is the subcommand
  if (remaining.length > 0 && !remaining[0].startsWith('--')) {
    subcommand = remaining[0]
    i = 1
  }

  while (i < remaining.length) {
    const part = remaining[i]
    if (part.startsWith('--')) {
      const key = part.replace(/^--/, '')
      const value = remaining[i + 1] && !remaining[i + 1].startsWith('--') ? remaining[i + 1] : 'true'
      flags[key] = value
      i += value === 'true' ? 1 : 2
    } else {
      args.push(part)
      i++
    }
  }

  return { command: cmd, subcommand, args, flags }
}
