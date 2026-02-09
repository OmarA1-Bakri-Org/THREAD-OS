import { memo } from 'react'

interface DiffPreviewProps {
  diff: string
}

export const DiffPreview = memo(function DiffPreview({ diff }: DiffPreviewProps) {
  if (!diff) return null

  const lines = diff.split('\n')

  return (
    <div className="border rounded-lg my-2 overflow-hidden">
      <div className="text-xs font-medium text-muted-foreground px-3 py-1 bg-muted">
        Preview Changes
      </div>
      <pre className="text-xs p-3 overflow-x-auto font-mono">
        {lines.map((line, i) => {
          let className = ''
          if (line.startsWith('+')) className = 'text-green-600'
          else if (line.startsWith('-')) className = 'text-red-600'
          else if (line.startsWith('@@')) className = 'text-blue-500'
          return (
            <div key={i} className={className}>
              {line}
            </div>
          )
        })}
      </pre>
    </div>
  )
})
