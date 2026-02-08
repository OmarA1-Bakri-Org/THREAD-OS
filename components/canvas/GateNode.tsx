'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useUIStore } from '@/lib/ui/store'

function GateNodeComponent({ id, data }: NodeProps) {
  const d = data as { id: string; name: string; status: string; color: string }
  const setSelected = useUIStore(s => s.setSelectedNodeId)

  return (
    <div
      onClick={() => setSelected(id)}
      className="cursor-pointer flex items-center justify-center"
      style={{ width: 80, height: 80 }}
    >
      <Handle type="target" position={Position.Left} />
      <div
        className="flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow"
        style={{
          width: 60, height: 60, background: 'white',
          border: `2px solid ${d.color}`,
          transform: 'rotate(45deg)',
        }}
      >
        <div style={{ transform: 'rotate(-45deg)' }} className="text-center">
          <div className="text-[9px] font-mono">{d.id}</div>
          <div className="text-[8px]" style={{ color: d.color }}>{d.status}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export const GateNode = memo(GateNodeComponent)
