'use client'

import { useUIStore } from '@/lib/ui/store'
import { useStatus } from '@/lib/ui/api'
import { StepForm } from './StepForm'
import { StepActions } from './StepActions'

export function StepInspector() {
  const selectedNodeId = useUIStore(s => s.selectedNodeId)
  const { data: status } = useStatus()

  if (!selectedNodeId || !status) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        Select a step or gate to inspect
      </div>
    )
  }

  const step = status.steps.find(s => s.id === selectedNodeId)
  const gate = status.gates.find(g => g.id === selectedNodeId)

  if (!step && !gate) {
    return <div className="p-4 text-gray-400 text-sm">Node not found</div>
  }

  if (gate) {
    return (
      <div className="p-4">
        <h3 className="font-bold text-lg">Gate: {gate.id}</h3>
        <div className="mt-2 space-y-2">
          <div><span className="text-xs text-gray-500">Name:</span> {gate.name}</div>
          <div><span className="text-xs text-gray-500">Status:</span> <span className="font-mono">{gate.status}</span></div>
          {gate.dependsOn.length > 0 && <div><span className="text-xs text-gray-500">Dependencies:</span> {gate.dependsOn.join(', ')}</div>}
        </div>
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
