'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUIStore } from '@/lib/ui/store'
import { useSequence, useRunStep } from '@/lib/ui/api'
import { cn } from '@/lib/utils'

export function Toolbar() {
  const policyMode = useUIStore((s) => s.policyMode)
  const setPolicyMode = useUIStore((s) => s.setPolicyMode)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const minimapVisible = useUIStore((s) => s.minimapVisible)
  const toggleMinimap = useUIStore((s) => s.toggleMinimap)
  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const toggleInspector = useUIStore((s) => s.toggleInspector)
  const chatOpen = useUIStore((s) => s.chatOpen)
  const toggleChat = useUIStore((s) => s.toggleChat)

  const { data: sequenceData } = useSequence()
  const runStep = useRunStep()

  const runnableSteps = (sequenceData?.steps || []).filter(
    (s: { status: string }) => s.status === 'READY'
  )

  const handleRunRunnable = () => {
    for (const step of runnableSteps) {
      runStep.mutate(step.id)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-card">
      {/* Logo / Title */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-base font-bold tracking-tight">ThreadOS</span>
        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">v0.1</span>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Run Runnable */}
      <Button
        size="sm"
        variant="default"
        onClick={handleRunRunnable}
        disabled={runnableSteps.length === 0}
        className="gap-1.5"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
        Run Runnable
        {runnableSteps.length > 0 && (
          <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary-foreground/20 text-[10px] font-bold">
            {runnableSteps.length}
          </span>
        )}
      </Button>

      <div className="w-px h-5 bg-border" />

      {/* Policy Mode Toggle */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPolicyMode('SAFE')}
          className={cn(
            'px-2 py-1 rounded-l-md text-xs font-semibold transition-colors border',
            policyMode === 'SAFE'
              ? 'bg-green-500/15 text-green-600 border-green-500/30'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent',
          )}
        >
          SAFE
        </button>
        <button
          onClick={() => setPolicyMode('POWER')}
          className={cn(
            'px-2 py-1 rounded-r-md text-xs font-semibold transition-colors border',
            policyMode === 'POWER'
              ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent',
          )}
        >
          POWER
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <Input
          placeholder="Search steps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 w-48 pl-8 text-xs"
        />
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Minimap Toggle */}
      <Button
        size="sm"
        variant={minimapVisible ? 'secondary' : 'ghost'}
        onClick={toggleMinimap}
        className="h-8 gap-1.5 text-xs"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="13" y="13" width="6" height="6" rx="1" />
        </svg>
        Map
      </Button>

      {/* Inspector Toggle */}
      <Button
        size="sm"
        variant={inspectorOpen ? 'secondary' : 'ghost'}
        onClick={toggleInspector}
        className="h-8 gap-1.5 text-xs"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M15 3v18" />
        </svg>
        Inspector
      </Button>

      {/* Chat Toggle */}
      <Button
        size="sm"
        variant={chatOpen ? 'secondary' : 'ghost'}
        onClick={toggleChat}
        className="h-8 gap-1.5 text-xs"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Chat
      </Button>
    </div>
  )
}
