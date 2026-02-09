'use client'

import { useUIStore } from '@/lib/ui/store'
import { useStatus } from '@/lib/ui/api'
import { StepForm } from './StepForm'
import { StepActions } from './StepActions'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export function StepInspector() {
  const selectedNodeId = useUIStore(s => s.selectedNodeId)
  const { data: status, isLoading } = useStatus()

  if (!selectedNodeId) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        Select a step or gate to inspect
      </div>
    )
  }

  if (isLoading) return <LoadingSpinner message="Loading..." />

  if (!status) {
    return <div className="p-4 text-muted-foreground text-sm">No data available</div>
  }

  const step = status.steps.find(s => s.id === selectedNodeId)
  const gate = status.gates.find(g => g.id === selectedNodeId)

  if (!step && !gate) {
    return <div className="p-4 text-muted-foreground text-sm">Node not found</div>
  }

  if (gate) {
    return (
      <div className="p-4">
        <h3 className="font-bold text-lg">Gate: {gate.id}</h3>
        <dl className="mt-2 space-y-2">
          <div><dt className="text-xs text-muted-foreground inline">Name:</dt> <dd className="inline">{gate.name}</dd></div>
          <div><dt className="text-xs text-muted-foreground inline">Status:</dt> <dd className="inline font-mono">{gate.status}</dd></div>
          {gate.dependsOn.length > 0 && <div><dt className="text-xs text-muted-foreground inline">Dependencies:</dt> <dd className="inline">{gate.dependsOn.join(', ')}</dd></div>}
        </dl>
        <StepActions nodeId={gate.id} isGate={true} />
      </div>
    )
  }

  return (
    <div className="p-4">
      <h3 className="font-bold text-lg">{step!.id}</h3>
      <StepForm step={step!} />
      <StepActions nodeId={step!.id} isGate={false} />
    </div>
  )
}
