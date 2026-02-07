import { readSequence, writeSequence } from '../../sequence/parser'
import { validateDAG } from '../../sequence/dag'
import { StepNotFoundError } from '../../errors'
import type { Sequence } from '../../sequence/schema'

interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

interface DepResult {
  success: boolean
  action: string
  stepId: string
  depId: string
  message?: string
  error?: string
}

/**
 * Check whether a node (step or gate) exists in the sequence
 */
function nodeExists(sequence: Sequence, nodeId: string): boolean {
  return (
    sequence.steps.some(s => s.id === nodeId) ||
    sequence.gates.some(g => g.id === nodeId)
  )
}

/**
 * Add a dependency to a step
 */
async function addDep(
  basePath: string,
  stepId: string,
  depId: string
): Promise<DepResult> {
  const sequence = await readSequence(basePath)

  const step = sequence.steps.find(s => s.id === stepId)
  if (!step) {
    return {
      success: false,
      action: 'add',
      stepId,
      depId,
      error: new StepNotFoundError(stepId).message,
    }
  }

  // depId can be a step or a gate
  if (!nodeExists(sequence, depId)) {
    return {
      success: false,
      action: 'add',
      stepId,
      depId,
      error: `Dependency target not found: ${depId}`,
    }
  }

  if (step.depends_on.includes(depId)) {
    return {
      success: false,
      action: 'add',
      stepId,
      depId,
      error: `Step '${stepId}' already depends on '${depId}'`,
    }
  }

  step.depends_on.push(depId)

  // Validate DAG to ensure no cycle is created
  try {
    validateDAG(sequence)
  } catch (error) {
    // Roll back the change before returning
    step.depends_on.pop()
    return {
      success: false,
      action: 'add',
      stepId,
      depId,
      error: error instanceof Error ? error.message : 'DAG validation failed',
    }
  }

  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'add',
    stepId,
    depId,
    message: `Dependency '${depId}' added to step '${stepId}'`,
  }
}

/**
 * Remove a dependency from a step
 */
async function rmDep(
  basePath: string,
  stepId: string,
  depId: string
): Promise<DepResult> {
  const sequence = await readSequence(basePath)

  const step = sequence.steps.find(s => s.id === stepId)
  if (!step) {
    return {
      success: false,
      action: 'rm',
      stepId,
      depId,
      error: new StepNotFoundError(stepId).message,
    }
  }

  const depIndex = step.depends_on.indexOf(depId)
  if (depIndex === -1) {
    return {
      success: false,
      action: 'rm',
      stepId,
      depId,
      error: `Step '${stepId}' does not depend on '${depId}'`,
    }
  }

  step.depends_on.splice(depIndex, 1)
  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'rm',
    stepId,
    depId,
    message: `Dependency '${depId}' removed from step '${stepId}'`,
  }
}

/**
 * Dep command handler
 */
export async function depCommand(
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
): Promise<void> {
  const basePath = process.cwd()
  const stepId = args[0]
  const depId = args[1]

  let result: DepResult

  switch (subcommand) {
    case 'add': {
      if (!stepId || !depId) {
        result = {
          success: false,
          action: 'add',
          stepId: stepId || '',
          depId: depId || '',
          error: 'Usage: seqctl dep add <stepId> <depId>',
        }
      } else {
        result = await addDep(basePath, stepId, depId)
      }
      break
    }

    case 'rm': {
      if (!stepId || !depId) {
        result = {
          success: false,
          action: 'rm',
          stepId: stepId || '',
          depId: depId || '',
          error: 'Usage: seqctl dep rm <stepId> <depId>',
        }
      } else {
        result = await rmDep(basePath, stepId, depId)
      }
      break
    }

    default: {
      result = {
        success: false,
        action: subcommand || 'unknown',
        stepId: '',
        depId: '',
        error: 'Unknown subcommand. Usage: seqctl dep add|rm',
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result))
  } else {
    if (result.success) {
      console.log(result.message)
    } else {
      console.error(`Error: ${result.error}`)
      process.exit(1)
    }
  }
}
