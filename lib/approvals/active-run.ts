import { join } from 'path'
import type { Approval } from '@/lib/contracts/schemas'
import { withFileLock } from '@/lib/fs/file-lock'
import { cancelRun } from '@/lib/thread-surfaces/mutations'
import { readThreadSurfaceState, withThreadSurfaceStateRevision, writeThreadSurfaceState } from '@/lib/thread-surfaces/repository'
import type { RunScope } from '@/lib/thread-surfaces/types'
import { hasApprovedApproval } from './repository'

const activeRunStatuses = new Set(['pending', 'running'])
const approvalClaimLockTarget = '.threados/state/approval-run-claim'

async function withClaimLock<T>(basePath: string, work: () => Promise<T>): Promise<T> {
  return withFileLock(join(basePath, approvalClaimLockTarget), work, {
    label: 'approval run claim lock',
  })
}

async function runHasApprovals(basePath: string, runId: string, targetRefs: string[], actionType: Approval['action_type']): Promise<boolean> {
  for (const targetRef of targetRefs) {
    if (!await hasApprovedApproval(basePath, runId, targetRef, actionType)) return false
  }
  return true
}

function newestFirst(runs: RunScope[]): RunScope[] {
  return [...runs].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
}

export async function findApprovedActiveRunId(
  basePath: string,
  targetRefs: string[],
  actionType: Approval['action_type'] = 'run',
): Promise<string | null> {
  if (targetRefs.length === 0) return null
  const state = await readThreadSurfaceState(basePath)
  for (const run of newestFirst(state.runs.filter(candidate => activeRunStatuses.has(candidate.runStatus)))) {
    if (await runHasApprovals(basePath, run.id, targetRefs, actionType)) return run.id
  }
  return null
}

export async function claimApprovedActiveRunId(
  basePath: string,
  targetRefs: string[],
  claimantRunId: string,
  actionType: Approval['action_type'] = 'run',
): Promise<string | null> {
  if (targetRefs.length === 0) return null
  return withClaimLock(basePath, async () => {
    const currentState = await readThreadSurfaceState(basePath)
    const candidates = newestFirst(currentState.runs.filter(run =>
      activeRunStatuses.has(run.runStatus)
      && (run.approvalClaimedByRunId == null || run.approvalClaimedByRunId === claimantRunId)
    ))
    for (const candidate of candidates) {
      if (!await runHasApprovals(basePath, candidate.id, targetRefs, actionType)) continue
      if (candidate.approvalClaimedByRunId === claimantRunId) return candidate.id
      const nextState = {
        ...currentState,
        runs: currentState.runs.map(run => run.id === candidate.id ? { ...run, approvalClaimedByRunId: claimantRunId } : run),
      }
      await writeThreadSurfaceState(basePath, withThreadSurfaceStateRevision(currentState, nextState))
      return candidate.id
    }
    return null
  })
}

export async function releaseApprovalClaims(basePath: string, claimantRunId: string): Promise<void> {
  await withClaimLock(basePath, async () => {
    const currentState = await readThreadSurfaceState(basePath)
    if (!currentState.runs.some(run => run.approvalClaimedByRunId === claimantRunId)) return
    const nextState = {
      ...currentState,
      runs: currentState.runs.map(run => {
        if (run.approvalClaimedByRunId !== claimantRunId) return run
        const { approvalClaimedByRunId: _claim, ...rest } = run
        return rest
      }),
    }
    await writeThreadSurfaceState(basePath, withThreadSurfaceStateRevision(currentState, nextState))
  })
}

export async function retireApprovalClaims(basePath: string, claimantRunId: string): Promise<void> {
  await withClaimLock(basePath, async () => {
    const currentState = await readThreadSurfaceState(basePath)
    const claimedIds = currentState.runs.filter(run => run.approvalClaimedByRunId === claimantRunId).map(run => run.id)
    if (claimedIds.length === 0) return
    let nextState = currentState
    const endedAt = new Date().toISOString()
    for (const runId of claimedIds) nextState = cancelRun(nextState, { runId, endedAt }).state
    nextState = {
      ...nextState,
      runs: nextState.runs.map(run => {
        if (!claimedIds.includes(run.id)) return run
        const { approvalClaimedByRunId: _claim, ...rest } = run
        return rest
      }),
    }
    await writeThreadSurfaceState(basePath, withThreadSurfaceStateRevision(currentState, nextState))
  })
}

export async function retireApprovalRun(basePath: string, runId: string): Promise<void> {
  await withClaimLock(basePath, async () => {
    const currentState = await readThreadSurfaceState(basePath)
    const run = currentState.runs.find(candidate => candidate.id === runId)
    if (!run || !activeRunStatuses.has(run.runStatus)) return
    const nextState = cancelRun(currentState, { runId, endedAt: new Date().toISOString() }).state
    await writeThreadSurfaceState(basePath, withThreadSurfaceStateRevision(currentState, nextState))
  })
}
