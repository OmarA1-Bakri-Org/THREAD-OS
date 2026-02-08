'use client'

import type { ProposedAction } from '@/lib/chat/validator'

interface ActionCardProps {
  actions: ProposedAction[]
  onApply: (actions: ProposedAction[]) => void
  onDiscard: () => void
}

export function ActionCard({ actions, onApply, onDiscard }: ActionCardProps) {
  if (actions.length === 0) return null

  return (
    <div className="border rounded-lg p-3 my-2 bg-card">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Proposed Actions ({actions.length})
      </div>
      <ul className="space-y-1 mb-3">
        {actions.map((action, i) => (
          <li key={i} className="text-sm font-mono bg-muted px-2 py-1 rounded">
            {action.command} {JSON.stringify(action.args)}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          onClick={() => onApply(actions)}
          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Apply
        </button>
        <button
          onClick={onDiscard}
          className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:opacity-90"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
