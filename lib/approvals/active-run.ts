import type { Approval } from '@/lib/contracts/schemas'
import { cancelRun } from '@/lib/thread-surfaces/mutations'
import { readThreadSurfaceState, withThreadSurfaceStateRevision, writeThreadSurfaceState } from '@/lib/thread-surfaces/repository'
import { hasApprovedApproval } from './repository'

const ACTIVE_RUN_STATUSES = new Set(['pending', 'running'])

export async function findApprovedActiveRunId(
  basePath: string,
  targetRefs: string[],
  actionType: Approval['action_type'] = 'run',
): Promise<string | null> {
  if (targetRefs.length === 0) return null
  const state = await readThreadSurfaceState(basePath)
  const activeRuns = [...state.runs]
    .filter(run => ACTIVE_RUN_STATUSES.has(run.runStatus))
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))

  for (const run of activeRuns) {
    let allApproved = true
    for (const targetRef of targetRefs) {
      if (!await hasApprovedApproval(basePath, run.id, targetRef, actionType)) {
        allApproved = false
        break
      }
    }
    if (allApproved) return run.id
  }
  return null
}

export async function retireApprovalRun(basePath: string, runId: string): Promise<void> {
  const currentState = await readThreadSurfaceState(basePath)
  const run = currentState.runs.find(candidate => candidate.id === runId)
  if (!run || !ACTIVE_RUN_STATUSES.has(run.runStatus)) return
  const nextState = cancelRun(currentState, { runId, endedAt: new Date().toISOString() }).state
  await writeThreadSurfaceState(basePath, withThreadSurfaceStateRevision(currentState, nextState))
}
