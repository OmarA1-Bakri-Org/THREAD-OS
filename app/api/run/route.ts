import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { validateDAG, topologicalSort } from '@/lib/sequence/dag'
import { updateStepProcess, readMprocsMap } from '@/lib/mprocs/state'
import { runStep } from '@/lib/runner/wrapper'
import { saveRunArtifacts } from '@/lib/runner/artifacts'
import {
  StepNotFoundError,
  GroupNotFoundError,
} from '@/lib/errors'
import type { Step, Sequence, StepStatus } from '@/lib/sequence/schema'

const RunBodySchema = z.object({
  stepId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
})

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

/**
 * Get runnable steps (READY status with all dependencies satisfied)
 */
function getRunnableSteps(sequence: Sequence): Step[] {
  const doneSteps = new Set(
    sequence.steps.filter((s) => s.status === 'DONE').map((s) => s.id)
  )

  const approvedGates = new Set(
    sequence.gates.filter((g) => g.status === 'APPROVED').map((g) => g.id)
  )

  const completedNodes = new Set([...doneSteps, ...approvedGates])

  return sequence.steps.filter((step) => {
    if (step.status !== 'READY') return false
    return step.depends_on.every((depId) => completedNodes.has(depId))
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
  const step = sequence.steps.find((s) => s.id === stepId)
  if (!step) {
    throw new StepNotFoundError(stepId)
  }

  step.status = 'RUNNING'
  await writeSequence(basePath, sequence)

  try {
    const result = await runStep({
      stepId,
      runId,
      command: step.model,
      args: ['--prompt-file', step.prompt_file],
      cwd: step.cwd,
    })

    const artifactPath = await saveRunArtifacts(basePath, result)

    step.status = result.status === 'SUCCESS' ? 'DONE' : 'FAILED'
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
    } catch {
      // Ignore write errors during failure handling
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

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = RunBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Invalid request: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        },
        { status: 400 }
      )
    }

    const { stepId, groupId } = parsed.data
    const basePath = process.cwd()
    const runId = randomUUID()

    const sequence = await readSequence(basePath)
    validateDAG(sequence)

    // --- Run single step ---
    if (stepId) {
      const step = sequence.steps.find((s) => s.id === stepId)
      if (!step) {
        return NextResponse.json(
          { error: new StepNotFoundError(stepId).message },
          { status: 404 }
        )
      }

      const result = await executeSingleStep(
        basePath,
        sequence,
        stepId,
        runId
      )

      const mprocsMap = await readMprocsMap(basePath)
      const processIndex = Object.keys(mprocsMap).length
      await updateStepProcess(basePath, stepId, processIndex)

      return NextResponse.json(result)
    }

    // --- Run group ---
    if (groupId) {
      const groupSteps = sequence.steps.filter((s) => s.group_id === groupId)
      if (groupSteps.length === 0) {
        return NextResponse.json(
          { error: new GroupNotFoundError(groupId).message },
          { status: 404 }
        )
      }

      const readyGroupSteps = groupSteps.filter((s) => s.status === 'READY')
      const results = await Promise.all(
        readyGroupSteps.map((step) =>
          executeSingleStep(basePath, sequence, step.id, runId)
        )
      )

      return NextResponse.json({
        success: results.every((r) => r.success),
        executed: results,
        skipped: [],
      })
    }

    // --- Run runnable frontier ---
    const runnableSteps = getRunnableSteps(sequence)

    if (runnableSteps.length === 0) {
      return NextResponse.json({
        success: true,
        executed: [],
        skipped: [],
        message: 'No runnable steps found',
      })
    }

    const order = topologicalSort(sequence)
    const orderedRunnable = order.filter((id) =>
      runnableSteps.some((s) => s.id === id)
    )

    const executed: RunStepResult[] = []
    const skipped: string[] = []

    for (const sid of orderedRunnable) {
      if (skipped.includes(sid)) continue

      const result = await executeSingleStep(basePath, sequence, sid, runId)
      executed.push(result)

      if (!result.success) {
        const dependentSteps = sequence.steps.filter(
          (s) =>
            s.depends_on.includes(sid) && orderedRunnable.includes(s.id)
        )
        for (const dep of dependentSteps) {
          if (!executed.some((e) => e.stepId === dep.id)) {
            skipped.push(dep.id)
          }
        }
      }
    }

    return NextResponse.json({
      success: executed.every((e) => e.success),
      executed,
      skipped,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to execute run',
      },
      { status: 500 }
    )
  }
}
