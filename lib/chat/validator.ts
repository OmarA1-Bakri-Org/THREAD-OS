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
 * Checks that each proposed action is a recognised seqctl command.
 *
 * @param actions - Proposed actions to validate
 * @param policyMode - Optional policy mode that may modify validation rules
 * @returns ValidationResult with `valid` set to `true` when all actions are recognised; `errors` is an array of objects each containing `actionId` and an `error` message
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
 * Produce a preview summary of how applying the proposed actions would change the current sequence.
 *
 * @param basePath - Filesystem path to the sequence repository to read the current sequence from
 * @param actions - Array of proposed actions to validate and include in the preview
 * @param policyMode - Optional policy mode string that influences command validation
 * @returns An object describing the dry-run result: on success `success` is `true` and `sequenceDiff` contains a short summary of proposed changes; on failure `success` is `false` and `errors` lists validation or system errors
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