export interface RunOutcomeEntry {
  success: boolean
  status: string
  confirmationRequired?: boolean
}

export interface BatchRunOutcome {
  success: boolean
  executed: RunOutcomeEntry[]
  waiting: string[]
}

export type RootRunStatus = 'pending' | 'successful' | 'failed'

export function resolveBatchRootRunStatus(result: BatchRunOutcome): RootRunStatus {
  const hasHardFailure = result.executed.some(entry => !entry.success && entry.status !== 'BLOCKED')
  if (hasHardFailure) return 'failed'
  const hasPendingAuthority = result.waiting.length > 0
    || result.executed.some(entry => entry.status === 'BLOCKED' || entry.confirmationRequired === true)
  if (hasPendingAuthority) return 'pending'
  return result.success ? 'successful' : 'failed'
}
