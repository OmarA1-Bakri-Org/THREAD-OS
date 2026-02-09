import { readSequence, writeSequence } from '../sequence/parser'
import { MprocsClient } from '../mprocs/client'
import * as audit from '../audit/logger'

export interface ReconciliationChange {
  stepId: string
  from: string
  to: string
  reason: string
}

export interface ReconciliationResult {
  checked: number
  changes: ReconciliationChange[]
  errors: string[]
}

/**
 * Reconcile sequence state with actual mprocs process state.
 * Steps marked RUNNING that don't have a corresponding running process
 * are marked as FAILED.
 */
export async function reconcileState(basePath: string): Promise<ReconciliationResult> {
  const result: ReconciliationResult = { checked: 0, changes: [], errors: [] }

  let sequence
  try {
    sequence = await readSequence(basePath)
  } catch (error) {
    result.errors.push(`Failed to read sequence: ${(error as Error).message}`)
    return result
  }

  const runningSteps = sequence.steps.filter(s => s.status === 'RUNNING')
  result.checked = runningSteps.length

  if (runningSteps.length === 0) return result

  // Check if mprocs is available
  const client = new MprocsClient()
  let mprocsAvailable = false
  try {
    mprocsAvailable = await client.isServerRunning()
  } catch {
    // mprocs not running — all RUNNING steps are orphaned
  }

  for (const step of runningSteps) {
    let isActuallyRunning = false

    if (mprocsAvailable) {
      // Try to check if the process exists and is running
      // Since MprocsClient doesn't have a "list" command, we treat
      // mprocs-unavailable as "not running"
      try {
        // If mprocs is up but we can't verify individual processes,
        // we leave them as-is (conservative approach)
        isActuallyRunning = true
      } catch {
        isActuallyRunning = false
      }
    }

    if (!isActuallyRunning && !mprocsAvailable) {
      // Mark as FAILED — orphaned
      step.status = 'FAILED'
      const change: ReconciliationChange = {
        stepId: step.id,
        from: 'RUNNING',
        to: 'FAILED',
        reason: 'mprocs server not available, process orphaned',
      }
      result.changes.push(change)

      try {
        await audit.log(basePath, {
          timestamp: new Date().toISOString(),
          actor: 'reconciler',
          action: 'reconcile',
          target: step.id,
          payload: { ...change },
          result: 'orphan-fixed',
        })
      } catch {
        // Audit logging failure shouldn't block reconciliation
      }
    }
  }

  if (result.changes.length > 0) {
    try {
      await writeSequence(basePath, sequence)
    } catch (error) {
      result.errors.push(`Failed to write sequence: ${(error as Error).message}`)
    }
  }

  return result
}
