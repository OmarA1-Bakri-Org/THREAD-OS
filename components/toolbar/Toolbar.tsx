'use client'

import { useUIStore } from '@/lib/ui/store'
import { useStatus, useRunRunnable } from '@/lib/ui/api'

export function Toolbar() {
  const { data: status } = useStatus()
  const runRunnable = useRunRunnable()
  const searchQuery = useUIStore(s => s.searchQuery)
  const setSearchQuery = useUIStore(s => s.setSearchQuery)
  const toggleMinimap = useUIStore(s => s.toggleMinimap)
  const toggleInspector = useUIStore(s => s.toggleInspector)

  return (
    <div className="h-12 border-b bg-white flex items-center px-4 gap-4 shrink-0">
      <span className="font-bold text-sm">ThreadOS</span>
      {status && <span className="text-xs text-gray-500">{status.name}</span>}
      <button
        onClick={() => runRunnable.mutate()}
        disabled={runRunnable.isPending}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {runRunnable.isPending ? 'Running...' : 'Run Runnable'}
      </button>
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search steps..."
        className="border rounded px-2 py-1 text-sm w-48"
      />
      <button onClick={toggleMinimap} className="text-xs text-gray-600 hover:text-gray-900">Minimap</button>
      <button onClick={toggleInspector} className="text-xs text-gray-600 hover:text-gray-900">Inspector</button>
      {status && (
        <div className="ml-auto flex gap-3 text-xs text-gray-500">
          <span>Ready: {status.summary.ready}</span>
          <span className="text-blue-600">Running: {status.summary.running}</span>
          <span className="text-green-600">Done: {status.summary.done}</span>
          <span className="text-red-600">Failed: {status.summary.failed}</span>
        </div>
      )}
    </div>
  )
}
