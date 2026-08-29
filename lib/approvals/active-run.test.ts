import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createTempDir, cleanTempDir } from '../../test/helpers/setup'
import { appendApproval } from './repository'
import { claimApprovedActiveRunId, releaseApprovalClaims, retireApprovalClaims } from './active-run'
import { writeThreadSurfaceState, readThreadSurfaceState } from '@/lib/thread-surfaces/repository'
import type { Approval } from '@/lib/contracts/schemas'

let basePath = ''
const target = 'step:approved'

function approval(overrides: Partial<Approval> = {}): Approval {
  return { id: 'apr-1', action_type: 'run', target_ref: target, requested_by: 'tester', status: 'approved', approved_by: 'reviewer', approved_at: '2026-08-29T00:00:00.000Z', notes: null, ...overrides }
}

beforeEach(async () => {
  basePath = await createTempDir()
  await writeThreadSurfaceState(basePath, {
    version: 1,
    threadSurfaces: [{ id: 'thread-root', parentSurfaceId: null, parentAgentNodeId: null, depth: 0, surfaceLabel: 'root', createdAt: '2026-08-29T00:00:00.000Z', childSurfaceIds: [], sequenceRef: null, spawnedByAgentId: null }],
    runs: [{ id: 'approval-run', threadSurfaceId: 'thread-root', runStatus: 'pending', startedAt: '2026-08-29T00:00:00.000Z', endedAt: null, parentRunId: null, childIndex: null }],
    mergeEvents: [], runEvents: [],
  })
  await appendApproval(basePath, 'approval-run', approval())
})
afterEach(async () => { await cleanTempDir(basePath) })

describe('approval run claims', () => {
  test('allows only one concurrent root request to claim the same approved run', async () => {
    const [left, right] = await Promise.all([
      claimApprovedActiveRunId(basePath, [target], 'request-a'),
      claimApprovedActiveRunId(basePath, [target], 'request-b'),
    ])
    expect([left, right].filter(Boolean)).toHaveLength(1)
    const state = await readThreadSurfaceState(basePath)
    const claimedBy = state.runs.find(run => run.id === 'approval-run')?.approvalClaimedByRunId
    expect(claimedBy === 'request-a' || claimedBy === 'request-b').toBe(true)
  })

  test('lets the same root request reuse its claim and release it when work remains blocked', async () => {
    await expect(claimApprovedActiveRunId(basePath, [target], 'request-a')).resolves.toBe('approval-run')
    await expect(claimApprovedActiveRunId(basePath, [target], 'request-a')).resolves.toBe('approval-run')
    await releaseApprovalClaims(basePath, 'request-a')
    const state = await readThreadSurfaceState(basePath)
    expect(state.runs.find(run => run.id === 'approval-run')?.approvalClaimedByRunId ?? null).toBeNull()
    expect(state.runs.find(run => run.id === 'approval-run')?.runStatus).toBe('pending')
  })

  test('retires all claims for a terminal root request only after execution finishes', async () => {
    await claimApprovedActiveRunId(basePath, [target], 'request-a')
    await retireApprovalClaims(basePath, 'request-a')
    const state = await readThreadSurfaceState(basePath)
    expect(state.runs.find(run => run.id === 'approval-run')?.runStatus).toBe('cancelled')
  })
})
