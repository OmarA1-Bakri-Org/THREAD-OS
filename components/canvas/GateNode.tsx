'use client'

import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useUIStore } from '@/lib/ui/store'

export interface GateNodeData {
  id: string
  name: string
  status: string
  color: string
  [key: string]: unknown
}

function GateNodeComponent({ id, data }: NodeProps<Node<GateNodeData>>) {
  const d = data as GateNodeData
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
      aria-label={`Gate ${d.name}, status ${d.status}`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className="cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
      style={{ width: 80, height: 80 }}
    >
      <Handle type="target" position={Position.Left} />
      <div
        className="flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow"
        style={{
          width: 60, height: 60, background: 'hsl(var(--card))',
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
