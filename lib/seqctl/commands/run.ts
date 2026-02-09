import { randomUUID } from 'crypto'
import { readSequence, writeSequence } from '../../sequence/parser'
import { validateDAG, topologicalSort } from '../../sequence/dag'
import { updateStepProcess, readMprocsMap } from '../../mprocs/state'
import { runStep } from '../../runner/wrapper'
import { saveRunArtifacts } from '../../runner/artifacts'
import { StepNotFoundError, GroupNotFoundError } from '../../errors'
import type { Step, Sequence, StepStatus } from '../../sequence/schema'

interface CLIOptions {
  json: boolean
  help: boolean
  watch: boolean
}

interface RunStepResult {
  success: boolean
  stepId: string
  runId: string
  status: StepStatus
  duration?: number
  exitCode?: number | null
  artifactPath?: string
  error?: string
}

interface RunRunnableResult {
  success: boolean
  executed: RunStepResult[]
  skipped: string[]
  error?: string
}

/**
 * Get runnable steps (READY status with all dependencies satisfied)
 */
function getRunnableSteps(sequence: Sequence): Step[] {
  const doneSteps = new Set(
    sequence.steps
      .filter(s => s.status === 'DONE')
      .map(s => s.id)
  )

  // Gates that are approved also count as done
  const approvedGates = new Set(
    sequence.gates
      .filter(g => g.status === 'APPROVED')
      .map(g => g.id)
  )

  const completedNodes = new Set([...doneSteps, ...approvedGates])

  return sequence.steps.filter(step => {
    if (step.status !== 'READY') return false

    // Check all dependencies are satisfied
    return step.depends_on.every(depId => completedNodes.has(depId))
  })
}

/**
 * Execute a single step
 */
async function executeSingleStep(
  basePath: string,
  sequence: Sequence,
  stepId: string,
  runId: string
): Promise<RunStepResult> {
  const step = sequence.steps.find(s => s.id === stepId)
  if (!step) {
    throw new StepNotFoundError(stepId)
  }

  // Update status to RUNNING
  step.status = 'RUNNING'
  await writeSequence(basePath, sequence)

  try {
    // Execute the step
    const result = await runStep({
      stepId,
      runId,
      command: step.model, // In reality this would be the actual command
      args: ['--prompt-file', step.prompt_file],
      cwd: step.cwd,
    })

    // Save artifacts
    const artifactPath = await saveRunArtifacts(basePath, result)

    // Update status based on result
    if (result.status === 'SUCCESS') {
      step.status = 'DONE'
    } else {
      step.status = 'FAILED'
    }
    await writeSequence(basePath, sequence)

    return {
      success: result.status === 'SUCCESS',
      stepId,
      runId,
      status: step.status,
      duration: result.duration,
      exitCode: result.exitCode,
      artifactPath,
    }
  } catch (error) {
    step.status = 'FAILED'
    try {
      await writeSequence(basePath, sequence)
    } catch (writeError) {
      console.error(
        `Failed to persist failed step '${stepId}' for run '${runId}':`,
        writeError
      )
    }

    return {
      success: false,
      stepId,
      runId,
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Execute a run subcommand for steps, runnable steps or groups within the current sequence.
 *
 * Handles three subcommands:
 * - "step": run a specific step by ID, update process mapping and print the step result.
 * - "runnable": run all READY steps whose dependencies are satisfied in topological order, collect executed and skipped steps.
 * - "group": run all READY steps in a named group serially and collect results.
 *
 * Output is printed either as JSON when `options.json` is true, or as human-readable text. Exits the process with code 1 for missing required arguments or unknown subcommands.
 *
 * @param subcommand - The subcommand to run: "step", "runnable" or "group"
 * @param args - Positional arguments for the subcommand (e.g. stepId or groupId as first element)
 * @param options - CLI options (controls JSON output and other flags)
 * @throws GroupNotFoundError - If a specified groupId does not exist in the sequence
 * @throws StepNotFoundError - If a specified stepId cannot be found when attempting to run a step
 */
export async function runCommand(
  subcommand: string | undefined,
  args: string[],
  options: CLIOptions
): Promise<void> {
  const basePath = process.cwd()
  const runId = randomUUID()

  // Read and validate sequence
  const sequence = await readSequence(basePath)
  validateDAG(sequence)

  if (subcommand === 'step') {
    // Run a specific step
    const stepId = args[0]
    if (!stepId) {
      const errorMsg = 'Step ID required: seqctl run step <stepId>'
      if (options.json) {
        console.log(JSON.stringify({ error: errorMsg, success: false }))
      } else {
        console.error(errorMsg)
      }
      process.exit(1)
    }

    const result = await executeSingleStep(
      basePath,
      sequence,
      stepId,
      runId
    )

    // Update mprocs map
    const mprocsMap = await readMprocsMap(basePath)
    const processIndex = Object.keys(mprocsMap).length
    await updateStepProcess(basePath, stepId, processIndex)

    if (options.json) {
      console.log(JSON.stringify(result))
    } else {
      if (result.success) {
        console.log(`Step '${stepId}' completed successfully`)
        console.log(`Duration: ${result.duration}ms`)
        console.log(`Artifacts: ${result.artifactPath}`)
      } else {
        console.error(`Step '${stepId}' failed: ${result.error || 'Unknown error'}`)
      }
    }
  } else if (subcommand === 'runnable') {
    // Run all runnable steps
    const runnableSteps = getRunnableSteps(sequence)

    if (runnableSteps.length === 0) {
      const result: RunRunnableResult = {
        success: true,
        executed: [],
        skipped: [],
        error: 'No runnable steps found',
      }
      if (options.json) {
        console.log(JSON.stringify(result))
      } else {
        console.log('No runnable steps found')
      }
      return
    }

    // Get topological order and filter to runnable
    const order = topologicalSort(sequence)
    const orderedRunnable = order.filter(id =>
      runnableSteps.some(s => s.id === id)
    )

    const executed: RunStepResult[] = []
    const skipped: string[] = []

    for (const stepId of orderedRunnable) {
      const result = await executeSingleStep(
        basePath,
        sequence,
        stepId,
        runId
      )
      executed.push(result)

      // If a step fails, we might want to skip dependent steps
      if (!result.success) {
        // Find steps that depend on this one and mark them as skipped
        const dependentSteps = sequence.steps.filter(s =>
          s.depends_on.includes(stepId) && orderedRunnable.includes(s.id)
        )
        for (const dep of dependentSteps) {
          if (!executed.some(e => e.stepId === dep.id)) {
            skipped.push(dep.id)
          }
        }
      }
    }

    const result: RunRunnableResult = {
      success: executed.every(e => e.success),
      executed,
      skipped,
    }

    if (options.json) {
      console.log(JSON.stringify(result))
    } else {
      console.log(`Executed ${executed.length} step(s)`)
      for (const e of executed) {
        const status = e.success ? 'DONE' : 'FAILED'
        console.log(`  ${e.stepId}: ${status} (${e.duration}ms)`)
      }
      if (skipped.length > 0) {
        console.log(`Skipped ${skipped.length} step(s) due to failures:`)
        for (const s of skipped) {
          console.log(`  ${s}`)
        }
      }
    }
  } else if (subcommand === 'group') {
    // Run all READY steps in a group
    const groupId = args[0]
    if (!groupId) {
      const errorMsg = 'Group ID required: seqctl run group <groupId>'
      if (options.json) {
        console.log(JSON.stringify({ error: errorMsg, success: false }))
      } else {
        console.error(errorMsg)
      }
      process.exit(1)
    }

    const groupSteps = sequence.steps.filter(s => s.group_id === groupId)
    if (groupSteps.length === 0) {
      throw new GroupNotFoundError(groupId)
    }

    const readyGroupSteps = groupSteps.filter(s => s.status === 'READY')
    const executed: RunStepResult[] = []

    // Run group steps serially to avoid concurrent writes
    for (const step of readyGroupSteps) {
      const result = await executeSingleStep(basePath, sequence, step.id, runId)
      executed.push(result)
    }

    const result: RunRunnableResult = {
      success: executed.every(e => e.success),
      executed,
      skipped: [],
    }

    if (options.json) {
      console.log(JSON.stringify(result))
    } else {
      console.log(`Executed ${executed.length} step(s) in group '${groupId}'`)
      for (const e of executed) {
        const status = e.success ? 'DONE' : 'FAILED'
        console.log(`  ${e.stepId}: ${status} (${e.duration}ms)`)
      }
    }
  } else {
    const errorMsg = 'Unknown subcommand. Usage: seqctl run step|runnable|group'
    if (options.json) {
      console.log(JSON.stringify({ error: errorMsg, success: false }))
    } else {
      console.error(errorMsg)
    }
    process.exit(1)
  }
}