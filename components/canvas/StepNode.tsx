'use client'

import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useUIStore } from '@/lib/ui/store'

export interface StepNodeData {
  id: string
  name: string
  status: string
  type: string
  model: string
  color: string
  [key: string]: unknown
}

function StepNodeComponent({ id, data }: NodeProps<Node<StepNodeData>>) {
  const d = data as StepNodeData
  const setSelected = useUIStore(s => s.setSelectedNodeId)

  const handleSelect = useCallback(() => setSelected(id), [setSelected, id])
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleSelect()
      }
    },
    [handleSelect]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Step ${d.name}, status ${d.status}`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className="rounded-lg border-2 bg-card px-3 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      style={{ borderColor: d.color, minWidth: 180 }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">{d.id}</span>
        <span className="text-[10px] px-1 rounded" style={{ background: d.color, color: '#fff' }}>{d.status}</span>
      </div>
      <div className="text-sm font-medium truncate">{d.name}</div>
      <div className="flex gap-1 mt-1">
        <span className="text-[10px] bg-muted px-1 rounded">{d.type}</span>
        <span className="text-[10px] bg-muted px-1 rounded">{d.model}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export const StepNode = memo(StepNodeComponent)
