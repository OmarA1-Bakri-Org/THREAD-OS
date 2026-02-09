import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useSequence() {
  return useQuery({
    queryKey: ['sequence'],
    queryFn: () => fetch('/api/sequence').then(r => r.json()),
    refetchInterval: 2000,
  })
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => fetch('/api/status').then(r => r.json()),
    refetchInterval: 1000,
  })
}

export function useRunStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stepId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status'] }); qc.invalidateQueries({ queryKey: ['sequence'] }) },
  })
}

export function useStopStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      fetch('/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stepId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status'] }); qc.invalidateQueries({ queryKey: ['sequence'] }) },
  })
}

export function useRestartStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (stepId: string) =>
      fetch('/api/restart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stepId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status'] }); qc.invalidateQueries({ queryKey: ['sequence'] }) },
  })
}

/**
 * Creates a React Query mutation hook that approves a gate and refreshes related queries.
 *
 * Sends a POST to `/api/gate` with body `{ action: 'approve', gateId }`; on success it invalidates the `['status']` and `['sequence']` queries.
 *
 * @returns The mutation object from React Query — exposes `mutate`/`mutateAsync`, status flags and other helpers.
 */
export function useApproveGate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gateId: string) =>
      fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', gateId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status'] }); qc.invalidateQueries({ queryKey: ['sequence'] }) },
  })
}

/**
 * Creates a React Query mutation that blocks a gate by its identifier.
 *
 * @returns A mutation object which, when executed with a `gateId`, posts `{ action: 'block', gateId }` to `/api/gate` and, on success, invalidates the `['status']` and `['sequence']` queries.
 */
export function useBlockGate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gateId: string) =>
      fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'block', gateId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status'] }); qc.invalidateQueries({ queryKey: ['sequence'] }) },
  })
}