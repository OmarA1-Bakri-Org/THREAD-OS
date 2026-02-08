'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useUIStore } from '@/lib/ui/store'

function StepNodeComponent({ id, data }: NodeProps) {
  const d = data as { id: string; name: string; status: string; type: string; model: string; color: string }
  const setSelected = useUIStore(s => s.setSelectedNodeId)

  return (
    <div
      onClick={() => setSelected(id)}
      className="rounded-lg border-2 bg-white px-3 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderColor: d.color, minWidth: 180 }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-gray-500">{d.id}</span>
        <span className="text-[10px] px-1 rounded" style={{ background: d.color, color: '#fff' }}>{d.status}</span>
      </div>
      <div className="text-sm font-medium truncate">{d.name}</div>
      <div className="flex gap-1 mt-1">
        <span className="text-[10px] bg-gray-100 px-1 rounded">{d.type}</span>
        <span className="text-[10px] bg-gray-100 px-1 rounded">{d.model}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export const StepNode = memo(StepNodeComponent)
