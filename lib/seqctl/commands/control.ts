import { readSequence, writeSequence } from '../../sequence/parser'
import { StepNotFoundError } from '../../errors'
import { MprocsClient } from '../../mprocs/client'
import { readMprocsMap } from '../../mprocs/state'

interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

interface ControlResult {
  success: boolean
  action: string
  stepId: string
  status?: string
  message?: string
  error?: string
}

/**
 * Stop a sequence step that is currently running and persist the updated sequence.
 *
 * Attempts to stop the process associated with `stepId` via the provided `mprocsClient`.
 * If the step is found and running, its status is set to `'FAILED'` and the sequence is written back;
 * otherwise the result describes the error condition (missing step, not running, missing process index,
 * or failure to stop the process).
 *
 * @param basePath - Filesystem path containing the sequence and mprocs map
 * @param stepId - Identifier of the step to stop
 * @param mprocsClient - Client used to control managed processes
 * @returns A ControlResult describing success or failure. On success `status` will be `'FAILED'` and `message` will confirm the stop; on failure `error` will contain a descriptive message. 
 */
async function stopStep(
  basePath: string,
  stepId: string,
  mprocsClient: MprocsClient
): Promise<ControlResult> {
  const sequence = await readSequence(basePath)

  const step = sequence.steps.find(s => s.id === stepId)
  if (!step) {
    return {
      success: false,
      action: 'stop',
      stepId,
      error: new StepNotFoundError(stepId).message,
    }
  }

  if (step.status !== 'RUNNING') {
    return {
      success: false,
      action: 'stop',
      stepId,
      error: `Step '${stepId}' is not running (status: ${step.status})`,
    }
  }

  const mprocsMap = await readMprocsMap(basePath)
  const processIndex = mprocsMap[stepId]

  if (processIndex === undefined) {
    return {
      success: false,
      action: 'stop',
      stepId,
      error: `No process index found for step '${stepId}' in mprocs-map.json`,
    }
  }

  try {
    await mprocsClient.stopProcess(processIndex)
  } catch (error) {
    return {
      success: false,
      action: 'stop',
      stepId,
      error: `Failed to stop process: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  step.status = 'FAILED'
  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'stop',
    stepId,
    status: step.status,
    message: `Step '${stepId}' stopped successfully`,
  }
}

/**
 * Restart the process associated with a sequence step.
 *
 * @param basePath - Filesystem path containing the sequence and mprocs-map.json
 * @param stepId - Identifier of the step to restart
 * @returns A ControlResult describing the outcome: on success `success: true`, `action: 'restart'`, `stepId`, `status: 'RUNNING'` and a success `message`; on failure `success: false`, `action: 'restart'`, `stepId` and an `error` message explaining the reason
 */
async function restartStep(
  basePath: string,
  stepId: string,
  mprocsClient: MprocsClient
): Promise<ControlResult> {
  const sequence = await readSequence(basePath)

  const step = sequence.steps.find(s => s.id === stepId)
  if (!step) {
    return {
      success: false,
      action: 'restart',
      stepId,
      error: new StepNotFoundError(stepId).message,
    }
  }

  if (step.status !== 'RUNNING' && step.status !== 'FAILED' && step.status !== 'DONE') {
    return {
      success: false,
      action: 'restart',
      stepId,
      error: `Step '${stepId}' cannot be restarted (status: ${step.status})`,
    }
  }

  const mprocsMap = await readMprocsMap(basePath)
  const processIndex = mprocsMap[stepId]

  if (processIndex === undefined) {
    return {
      success: false,
      action: 'restart',
      stepId,
      error: `No process index found for step '${stepId}' in mprocs-map.json`,
    }
  }

  try {
    await mprocsClient.restartProcess(processIndex)
  } catch (error) {
    return {
      success: false,
      action: 'restart',
      stepId,
      error: `Failed to restart process: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  step.status = 'RUNNING'
  await writeSequence(basePath, sequence)

  return {
    success: true,
    action: 'restart',
    stepId,
    status: step.status,
    message: `Step '${stepId}' restarted successfully`,
  }
}

/**
 * Control command handler
 */
export async function controlCommand(
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
): Promise<void> {
  const basePath = process.cwd()
  const mprocsClient = new MprocsClient()

  let result: ControlResult

  switch (subcommand) {
    case 'stop': {
      const stepId = args[0]
      if (!stepId) {
        result = {
          success: false,
          action: 'stop',
          stepId: '',
          error: 'Step ID required: seqctl stop <stepId>',
        }
      } else {
        result = await stopStep(basePath, stepId, mprocsClient)
      }
      break
    }

    case 'restart': {
      const stepId = args[0]
      if (!stepId) {
        result = {
          success: false,
          action: 'restart',
          stepId: '',
          error: 'Step ID required: seqctl restart <stepId>',
        }
      } else {
        result = await restartStep(basePath, stepId, mprocsClient)
      }
      break
    }

    default: {
      result = {
        success: false,
        action: subcommand || 'unknown',
        stepId: '',
        error: 'Unknown subcommand. Usage: seqctl stop|restart <stepId>',
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