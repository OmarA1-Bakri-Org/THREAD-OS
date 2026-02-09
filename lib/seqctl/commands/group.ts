import { parseArgs } from 'util'
import { randomUUID } from 'crypto'
import { readSequence, writeSequence } from '../../sequence/parser'
import { StepNotFoundError } from '../../errors'
import type { Step } from '../../sequence/schema'

interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

interface GroupResult {
  success: boolean
  action: string
  groupId?: string
  steps?: string[]
  message?: string
  error?: string
  groups?: Array<{ groupId: string; steps: Array<{ id: string; name: string; status: string }> }>
}

/**
 * Parse group subcommand options
 */
function parseGroupArgs(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      'group-id': { type: 'string' },
      'fail-policy': { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  })

  return { values, positionals }
}

/**
 * Parallelize steps by assigning them a shared group_id
 */
async function parallelizeSteps(
  basePath: string,
  stepIds: string[],
  options: Record<string, unknown>
): Promise<GroupResult> {
  const sequence = await readSequence(basePath)

  // Validate all step IDs exist
  for (const stepId of stepIds) {
    const step = sequence.steps.find(s => s.id === stepId)
    if (!step) {
      return {
        success: false,
        action: 'parallelize',
        error: new StepNotFoundError(stepId).message,
      }
    }
  }

  const groupId = (options['group-id'] as string) || randomUUID()
  const failPolicy = options['fail-policy'] as string | undefined

  // Assign group_id and type to all steps
  for (const stepId of stepIds) {
    const step = sequence.steps.find(s => s.id === stepId)!
    step.group_id = groupId
    step.type = 'p'
    if (failPolicy) {
      step.fail_policy = failPolicy as Step['fail_policy']
    }
  }

  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'parallelize',
    groupId,
    steps: stepIds,
    message: `Steps [${stepIds.join(', ')}] parallelized in group '${groupId}'`,
  }
}

/**
 * List all groups with their member steps
 */
async function listGroups(basePath: string): Promise<GroupResult> {
  const sequence = await readSequence(basePath)

  const groupMap = new Map<string, Array<{ id: string; name: string; status: string }>>()

  for (const step of sequence.steps) {
    if (!step.group_id) continue

    if (!groupMap.has(step.group_id)) {
      groupMap.set(step.group_id, [])
    }

    groupMap.get(step.group_id)!.push({
      id: step.id,
      name: step.name,
      status: step.status,
    })
  }

  const groups = Array.from(groupMap.entries()).map(([groupId, steps]) => ({
    groupId,
    steps,
  }))

  return {
    success: true,
    action: 'list',
    groups,
    message: groups.length > 0
      ? `Found ${groups.length} group(s)`
      : 'No groups found',
  }
}

/**
 * Group command handler
 */
export async function groupCommand(
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
): Promise<void> {
  const basePath = process.cwd()
  const { values, positionals } = parseGroupArgs(args)

  let result: GroupResult

  switch (subcommand) {
    case 'parallelize': {
      const stepIds = positionals
      if (stepIds.length < 2) {
        result = {
          success: false,
          action: 'parallelize',
          error: 'At least 2 step IDs required: seqctl group parallelize <stepId1> <stepId2> [...]',
        }
      } else {
        result = await parallelizeSteps(basePath, stepIds, values)
      }
      break
    }

    case 'list': {
      result = await listGroups(basePath)
      break
    }

    default: {
      result = {
        success: false,
        action: subcommand || 'unknown',
        error: 'Unknown subcommand. Usage: seqctl group parallelize|list',
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result))
  } else {
    if (result.success) {
      if (result.action === 'list' && result.groups) {
        if (result.groups.length === 0) {
          console.log('No groups found')
        } else {
          for (const group of result.groups) {
            console.log(`Group: ${group.groupId}`)
            for (const step of group.steps) {
              console.log(`  - ${step.id} (${step.name}) [${step.status}]`)
            }
          }
        }
      } else {
        console.log(result.message)
      }
    } else {
      console.error(`Error: ${result.error}`)
      process.exit(1)
    }
  }
}
