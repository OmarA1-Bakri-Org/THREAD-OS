'use client'
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StepStatus = 'READY' | 'RUNNING' | 'DONE' | 'FAILED' | 'BLOCKED' | 'NEEDS_REVIEW'

interface StepNodeData {
  label: string
  type: string
  status: StepStatus
  model?: string
  [key: string]: unknown
}

const statusConfig: Record<StepStatus, { color: string; bg: string; pulse?: boolean }> = {
  READY:        { color: 'text-blue-500',   bg: 'bg-blue-500' },
  RUNNING:      { color: 'text-amber-500',  bg: 'bg-amber-500', pulse: true },
  DONE:         { color: 'text-green-500',  bg: 'bg-green-500' },
  FAILED:       { color: 'text-red-500',    bg: 'bg-red-500' },
  BLOCKED:      { color: 'text-gray-400',   bg: 'bg-gray-400' },
  NEEDS_REVIEW: { color: 'text-purple-500', bg: 'bg-purple-500' },
}

const typeIcons: Record<string, string> = {
  code:    '\u2318',
  test:    '\u2713',
  review:  '\u2687',
  deploy:  '\u2B06',
  prompt:  '\u2726',
  shell:   '\u25B6',
  gate:    '\u25C6',
}

function StepNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StepNodeData
  const status = nodeData.status || 'READY'
  const cfg = statusConfig[status] || statusConfig.READY

  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-muted-foreground !border-background" />
      <Card className={cn(
        'min-w-[180px] max-w-[220px] cursor-pointer transition-all duration-150',
        'hover:shadow-md',
        selected && 'ring-2 ring-primary shadow-lg',
      )}>
        <CardContent className="p-3 space-y-2">
          {/* Top row: type badge + status chip */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{typeIcons[nodeData.type] || '\u2022'}</span>
              {nodeData.type}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              cfg.color,
            )}>
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', cfg.bg, cfg.pulse && 'animate-pulse')} />
              {status}
            </span>
          </div>

          {/* Step name */}
          <p className="text-sm font-medium leading-tight truncate">{nodeData.label}</p>

          {/* Model indicator */}
          {nodeData.model && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM6.5 7.5h3v5h-1v-4h-2v-1z"/></svg>
              {nodeData.model}
            </span>
          )}
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-muted-foreground !border-background" />
    </>
  )
}

export const StepNode = memo(StepNodeComponent)
