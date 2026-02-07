import { NextResponse } from 'next/server'
import { readSequence } from '@/lib/sequence/parser'
import { readMprocsMap } from '@/lib/mprocs/state'
import type { Sequence, Step, Gate } from '@/lib/sequence/schema'
import type { MprocsMap } from '@/lib/mprocs/state'

interface StepStatusInfo {
  id: string
  name: string
  type: string
  status: string
  model: string
  dependsOn: string[]
  processIndex?: number
}

interface GateStatusInfo {
  id: string
  name: string
  status: string
  dependsOn: string[]
}

interface StatusSummary {
  total: number
  ready: number
  running: number
  done: number
  failed: number
  blocked: number
  needsReview: number
}

interface SequenceStatus {
  name: string
  version: string
  steps: StepStatusInfo[]
  gates: GateStatusInfo[]
  summary: StatusSummary
}

function buildStepStatus(step: Step, mprocsMap: MprocsMap): StepStatusInfo {
  return {
    id: step.id,
    name: step.name,
    type: step.type,
    status: step.status,
    model: step.model,
    dependsOn: step.depends_on,
    processIndex: mprocsMap[step.id],
  }
}

function buildGateStatus(gate: Gate): GateStatusInfo {
  return {
    id: gate.id,
    name: gate.name,
    status: gate.status,
    dependsOn: gate.depends_on,
  }
}

function buildSummary(sequence: Sequence): StatusSummary {
  const summary: StatusSummary = {
    total: sequence.steps.length,
    ready: 0,
    running: 0,
    done: 0,
    failed: 0,
    blocked: 0,
    needsReview: 0,
  }

  for (const step of sequence.steps) {
    switch (step.status) {
      case 'READY':
        summary.ready++
        break
      case 'RUNNING':
        summary.running++
        break
      case 'DONE':
        summary.done++
        break
      case 'FAILED':
        summary.failed++
        break
      case 'BLOCKED':
        summary.blocked++
        break
      case 'NEEDS_REVIEW':
        summary.needsReview++
        break
    }
  }

  return summary
}

export function buildSequenceStatus(
  sequence: Sequence,
  mprocsMap: MprocsMap
): SequenceStatus {
  return {
    name: sequence.name,
    version: sequence.version,
    steps: sequence.steps.map((s) => buildStepStatus(s, mprocsMap)),
    gates: sequence.gates.map((g) => buildGateStatus(g)),
    summary: buildSummary(sequence),
  }
}

export async function GET() {
  try {
    const basePath = process.cwd()
    const [sequence, mprocsMap] = await Promise.all([
      readSequence(basePath),
      readMprocsMap(basePath),
    ])

    const status = buildSequenceStatus(sequence, mprocsMap)
    return NextResponse.json(status)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read status' },
      { status: 500 }
    )
  }
}
