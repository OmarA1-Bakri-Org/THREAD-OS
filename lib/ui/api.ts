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

export function useApproveGate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gateId: string) =>
      fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', gateId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status'] }); qc.invalidateQueries({ queryKey: ['sequence'] }) },
  })
}

export function useBlockGate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gateId: string) =>
      fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'block', gateId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status'] }); qc.invalidateQueries({ queryKey: ['sequence'] }) },
  })
}
