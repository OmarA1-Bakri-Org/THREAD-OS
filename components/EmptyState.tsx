'use client'

import { FileQuestion } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">No Sequence Found</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Get started by initializing a new sequence:
        </p>
        <pre className="mt-3 px-4 py-2 bg-muted rounded text-sm font-mono">
          seqctl init my-project
        </pre>
      </div>
    </div>
  )
}
