import { readSequence, writeSequence } from '../sequence/parser'
import { MprocsClient } from '../mprocs/client'
import { readMprocsMap } from '../mprocs/state'
import { AuditLogger } from '../audit/logger'
import type { Sequence } from '../sequence/schema'

export interface ReconciliationResult {
  orphanedSteps: string[]
  reconciledSteps: string[]
  mprocsAvailable: boolean
}

/**
 * Reconcile sequence state with actual mprocs process state.
 * Marks orphaned RUNNING steps as FAILED and logs all actions.
 */
export async function reconcile(basePath: string): Promise<ReconciliationResult> {
  const sequence = await readSequence(basePath)
  const mprocsMap = await readMprocsMap(basePath)
  const audit = new AuditLogger(basePath)
  const client = new MprocsClient()

  const result: ReconciliationResult = {
    orphanedSteps: [],
    reconciledSteps: [],
    mprocsAvailable: false,
  }

  // Check if mprocs server is reachable
  try {
    result.mprocsAvailable = await client.isServerRunning()
  } catch {
    result.mprocsAvailable = false
  }

  // Find all steps marked as RUNNING
  const runningSteps = sequence.steps.filter(s => s.status === 'RUNNING')

  if (runningSteps.length === 0) {
    return result
  }

  for (const step of runningSteps) {
    const processIndex = mprocsMap[step.id]

    // If no mprocs server or no process mapping, the step is orphaned
    if (!result.mprocsAvailable || processIndex === undefined) {
      step.status = 'FAILED'
      result.orphanedSteps.push(step.id)

      await audit.log({
        actor: 'system',
        action: 'reconciliation.orphan',
        target: step.id,
        payload: {
          reason: !result.mprocsAvailable
            ? 'mprocs server unavailable'
            : 'no process mapping found',
          previousStatus: 'RUNNING',
          newStatus: 'FAILED',
        },
        policy_mode: 'SAFE',
        result: 'success',
      })

      result.reconciledSteps.push(step.id)
      continue
    }

    // If mprocs is available, try to check if the process is alive
    // We can do this by trying to select the process
    try {
      const selectResult = await client.sendCommand({
        c: 'select-proc',
        index: processIndex,
      })

      if (!selectResult.success) {
        // Process not found in mprocs — orphaned
        step.status = 'FAILED'
        result.orphanedSteps.push(step.id)
        result.reconciledSteps.push(step.id)

        await audit.log({
          actor: 'system',
          action: 'reconciliation.orphan',
          target: step.id,
          payload: {
            reason: 'process not found in mprocs',
            processIndex,
            previousStatus: 'RUNNING',
            newStatus: 'FAILED',
          },
          policy_mode: 'SAFE',
          result: 'success',
        })
      }
      // If select succeeded, the process is still alive — leave as RUNNING
    } catch {
      // Connection error — mark as orphaned
      step.status = 'FAILED'
      result.orphanedSteps.push(step.id)
      result.reconciledSteps.push(step.id)
    }
  }

  // Persist changes if any steps were reconciled
  if (result.reconciledSteps.length > 0) {
    await writeSequence(basePath, sequence)

    await audit.log({
      actor: 'system',
      action: 'reconciliation.complete',
      target: 'sequence',
      payload: {
        orphanedSteps: result.orphanedSteps,
        reconciledCount: result.reconciledSteps.length,
      },
      policy_mode: 'SAFE',
      result: 'success',
    })
  }

  return result
}
