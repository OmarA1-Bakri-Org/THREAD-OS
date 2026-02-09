'use client'
import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApproveGate, useBlockGate } from '@/lib/ui/api'

interface GateNodeData {
  label: string
  status: string
  gateId: string
  [key: string]: unknown
}

function GateNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as GateNodeData
  const [showActions, setShowActions] = useState(false)
  const approve = useApproveGate()
  const block = useBlockGate()

  const isPending = nodeData.status === 'PENDING' || nodeData.status === 'NEEDS_REVIEW'
  const isApproved = nodeData.status === 'APPROVED' || nodeData.status === 'DONE'
  const isBlocked = nodeData.status === 'BLOCKED'

  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-muted-foreground !border-background" />
      <div
        className={cn(
          'relative cursor-pointer',
          'group',
        )}
        onClick={() => setShowActions(!showActions)}
      >
        {/* Diamond shape */}
        <div className={cn(
          'w-20 h-20 rotate-45 rounded-md border-2 flex items-center justify-center transition-all duration-150',
          'hover:shadow-md',
          selected && 'ring-2 ring-primary shadow-lg',
          isPending && 'border-purple-500 bg-purple-500/10',
          isApproved && 'border-green-500 bg-green-500/10',
          isBlocked && 'border-red-500 bg-red-500/10',
          !isPending && !isApproved && !isBlocked && 'border-muted-foreground/40 bg-muted/50',
        )}>
          <div className="-rotate-45 text-center">
            <span className="text-lg font-bold">{'\u25C6'}</span>
          </div>
        </div>

        {/* Label below diamond */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <p className="text-xs font-medium text-center">{nodeData.label}</p>
          <p className={cn(
            'text-[10px] text-center font-medium',
            isPending && 'text-purple-500',
            isApproved && 'text-green-500',
            isBlocked && 'text-red-500',
          )}>
            {nodeData.status}
          </p>
        </div>

        {/* Action buttons */}
        {showActions && isPending && (
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            <Button
              size="sm"
              variant="default"
              className="h-6 text-[10px] px-2"
              onClick={(e) => {
                e.stopPropagation()
                approve.mutate(nodeData.gateId)
                setShowActions(false)
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-[10px] px-2"
              onClick={(e) => {
                e.stopPropagation()
                block.mutate(nodeData.gateId)
                setShowActions(false)
              }}
            >
              Block
            </Button>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-muted-foreground !border-background" />
    </>
  )
}

export const GateNode = memo(GateNodeComponent)
