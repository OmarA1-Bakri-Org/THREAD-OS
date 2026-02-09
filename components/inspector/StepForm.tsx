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
    <dl className="space-y-3 mt-3">
      <div>
        <dt className="text-xs text-muted-foreground">Name</dt>
        <dd className="text-sm font-medium">{step.name}</dd>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <dt className="text-xs text-muted-foreground">Type</dt>
          <dd className="text-sm">{step.type}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Model</dt>
          <dd className="text-sm">{step.model}</dd>
        </div>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Status</dt>
        <dd className="text-sm font-mono">{step.status}</dd>
      </div>
      {step.dependsOn.length > 0 && (
        <div>
          <dt className="text-xs text-muted-foreground">Dependencies</dt>
          <dd className="text-sm">{step.dependsOn.join(', ')}</dd>
        </div>
      )}
    </dl>
  )
}
