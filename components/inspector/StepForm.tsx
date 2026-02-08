'use client'

interface StepData {
  id: string
  name: string
  type: string
  model: string
  status: string
  dependsOn: string[]
}

export function StepForm({ step }: { step: StepData }) {
  return (
    <div className="space-y-3 mt-3">
      <div>
        <label className="text-xs text-gray-500">Name</label>
        <div className="text-sm font-medium">{step.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Type</label>
          <div className="text-sm">{step.type}</div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Model</label>
          <div className="text-sm">{step.model}</div>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Status</label>
        <div className="text-sm font-mono">{step.status}</div>
      </div>
      {step.dependsOn.length > 0 && (
        <div>
          <label className="text-xs text-gray-500">Dependencies</label>
          <div className="text-sm">{step.dependsOn.join(', ')}</div>
        </div>
      )}
    </div>
  )
}
