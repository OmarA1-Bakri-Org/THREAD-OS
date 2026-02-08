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
        <button
          onClick={() => approveGate.mutate(nodeId)}
          disabled={approveGate.isPending}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {approveGate.isPending ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Are you sure you want to block gate "${nodeId}"?`)) {
              blockGate.mutate(nodeId)
            }
          }}
          disabled={blockGate.isPending}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {blockGate.isPending ? 'Blocking...' : 'Block'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={() => runStep.mutate(nodeId)}
        disabled={runStep.isPending}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {runStep.isPending ? 'Running...' : 'Run'}
      </button>
      <button
        onClick={() => {
          if (window.confirm(`Are you sure you want to stop step "${nodeId}"?`)) {
            stopStep.mutate(nodeId)
          }
        }}
        disabled={stopStep.isPending}
        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
      >
        {stopStep.isPending ? 'Stopping...' : 'Stop'}
      </button>
      <button
        onClick={() => restartStep.mutate(nodeId)}
        disabled={restartStep.isPending}
        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
      >
        {restartStep.isPending ? 'Restarting...' : 'Restart'}
      </button>
    </div>
  )
}
