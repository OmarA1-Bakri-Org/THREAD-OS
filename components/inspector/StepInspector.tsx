'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/lib/ui/store'
import { useSequence, useRunStep, useStopStep, useRestartStep } from '@/lib/ui/api'
import { cn } from '@/lib/utils'

type StepStatus = 'READY' | 'RUNNING' | 'DONE' | 'FAILED' | 'BLOCKED' | 'NEEDS_REVIEW'

const statusColors: Record<StepStatus, string> = {
  READY:        'text-blue-500',
  RUNNING:      'text-amber-500',
  DONE:         'text-green-500',
  FAILED:       'text-red-500',
  BLOCKED:      'text-gray-400',
  NEEDS_REVIEW: 'text-purple-500',
}

const statusDots: Record<StepStatus, string> = {
  READY:        'bg-blue-500',
  RUNNING:      'bg-amber-500',
  DONE:         'bg-green-500',
  FAILED:       'bg-red-500',
  BLOCKED:      'bg-gray-400',
  NEEDS_REVIEW: 'bg-purple-500',
}

interface SequenceStep {
  id: string
  name: string
  type: string
  status: StepStatus
  model?: string
  depends_on?: string[]
  cwd?: string
}

// Fallback demo steps matching the canvas demo data
const DEMO_STEPS: SequenceStep[] = [
  { id: 'plan', name: 'Plan Implementation', type: 'prompt', status: 'DONE', model: 'claude-opus-4', cwd: '/workspace' },
  { id: 'scaffold', name: 'Scaffold Code', type: 'code', status: 'DONE', model: 'claude-sonnet-4', depends_on: ['plan'], cwd: '/workspace/src' },
  { id: 'implement', name: 'Implement Features', type: 'code', status: 'RUNNING', model: 'claude-opus-4', depends_on: ['scaffold'], cwd: '/workspace/src' },
  { id: 'test', name: 'Run Tests', type: 'test', status: 'READY', depends_on: ['implement'], cwd: '/workspace' },
  { id: 'review', name: 'Code Review', type: 'review', status: 'BLOCKED', model: 'claude-opus-4', depends_on: ['test'] },
  { id: 'deploy', name: 'Deploy to Staging', type: 'deploy', status: 'BLOCKED', depends_on: ['review'] },
]

export function StepInspector() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const { data: sequenceData } = useSequence()
  const runStep = useRunStep()
  const stopStep = useStopStep()
  const restartStep = useRestartStep()

  // Use real steps if available, otherwise demo steps
  const steps: SequenceStep[] = sequenceData?.steps || DEMO_STEPS
  const step = steps.find((s: SequenceStep) => s.id === selectedNodeId)

  if (!selectedNodeId || !step) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <path d="M15 15l6 6M10 17a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Select a step to inspect</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Click on any node in the canvas</p>
      </div>
    )
  }

  const status = step.status as StepStatus
  const isRunning = status === 'RUNNING'
  const isDone = status === 'DONE'
  const isFailed = status === 'FAILED'

  return (
    <div className="h-full overflow-y-auto">
      <Card className="border-0 rounded-none shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{step.name}</CardTitle>
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
              statusColors[status],
            )}>
              <span className={cn(
                'inline-block h-2 w-2 rounded-full',
                statusDots[status],
                isRunning && 'animate-pulse',
              )} />
              {status}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metadata */}
          <div className="space-y-2">
            <DetailRow label="ID" value={step.id} />
            <DetailRow label="Type" value={step.type} />
            {step.model && <DetailRow label="Model" value={step.model} />}
            {step.cwd && <DetailRow label="Working Dir" value={step.cwd} mono />}
          </div>

          <Separator />

          {/* Dependencies */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</p>
            {step.depends_on && step.depends_on.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {step.depends_on.map((dep: string) => (
                  <span key={dep} className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {dep}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No dependencies</p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                disabled={isRunning || isDone}
                onClick={() => runStep.mutate(step.id)}
                className="flex-1"
              >
                {runStep.isPending ? 'Starting...' : 'Run'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!isRunning}
                onClick={() => stopStep.mutate(step.id)}
                className="flex-1"
              >
                {stopStep.isPending ? 'Stopping...' : 'Stop'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isRunning || (!isDone && !isFailed)}
                onClick={() => restartStep.mutate(step.id)}
                className="flex-1"
              >
                {restartStep.isPending ? 'Restarting...' : 'Restart'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-xs text-right truncate', mono && 'font-mono')}>{value}</span>
    </div>
  )
}
