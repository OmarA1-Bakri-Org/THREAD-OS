'use client'

import { useRunStep, useStopStep, useRestartStep, useApproveGate, useBlockGate } from '@/lib/ui/api'

export function StepActions({ nodeId, isGate }: { nodeId: string; isGate: boolean }) {
  const runStep = useRunStep()
  const stopStep = useStopStep()
  const restartStep = useRestartStep()
  const approveGate = useApproveGate()
  const blockGate = useBlockGate()

  if (isGate) {
    return (
      <div className="flex gap-2 mt-3">
        <button onClick={() => approveGate.mutate(nodeId)} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">Approve</button>
        <button onClick={() => blockGate.mutate(nodeId)} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">Block</button>
      </div>
    )
  }

  return (
    <div className="flex gap-2 mt-3">
      <button onClick={() => runStep.mutate(nodeId)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Run</button>
      <button onClick={() => stopStep.mutate(nodeId)} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">Stop</button>
      <button onClick={() => restartStep.mutate(nodeId)} className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">Restart</button>
    </div>
  )
}
