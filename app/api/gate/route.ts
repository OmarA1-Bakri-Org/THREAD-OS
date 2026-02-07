import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { validateDAG } from '@/lib/sequence/dag'
import { GateNotFoundError } from '@/lib/errors'
import { GateSchema, type Gate, type GateStatus } from '@/lib/sequence/schema'

const InsertGateBody = z.object({
  action: z.literal('insert'),
  gateId: z.string().min(1),
  name: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
})

const ApproveGateBody = z.object({
  action: z.literal('approve'),
  gateId: z.string().min(1),
})

const BlockGateBody = z.object({
  action: z.literal('block'),
  gateId: z.string().min(1),
})

const GateActionSchema = z.discriminatedUnion('action', [
  InsertGateBody,
  ApproveGateBody,
  BlockGateBody,
])

export async function GET() {
  try {
    const basePath = process.cwd()
    const sequence = await readSequence(basePath)
    return NextResponse.json({
      success: true,
      gates: sequence.gates.map(g => ({
        id: g.id,
        name: g.name,
        status: g.status,
        depends_on: g.depends_on,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list gates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = GateActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parsed.error.issues.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const basePath = process.cwd()
    const sequence = await readSequence(basePath)
    const { action, gateId } = parsed.data

    if (action === 'insert') {
      if (sequence.gates.some(g => g.id === gateId)) {
        return NextResponse.json(
          { error: `Gate '${gateId}' already exists` },
          { status: 400 }
        )
      }

      const newGate: Gate = {
        id: gateId,
        name: parsed.data.name || gateId,
        depends_on: parsed.data.depends_on || [],
        status: 'PENDING' as GateStatus,
      }

      const validation = GateSchema.safeParse(newGate)
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues.map(e => e.message).join(', ') },
          { status: 400 }
        )
      }

      sequence.gates.push(validation.data)

      try {
        validateDAG(sequence)
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'DAG validation failed' },
          { status: 400 }
        )
      }

      await writeSequence(basePath, sequence)

      return NextResponse.json({
        success: true,
        action: 'insert',
        gateId,
        message: `Gate '${gateId}' inserted successfully`,
      })
    }

    if (action === 'approve') {
      const gateIndex = sequence.gates.findIndex(g => g.id === gateId)
      if (gateIndex === -1) {
        return NextResponse.json(
          { error: new GateNotFoundError(gateId).message },
          { status: 404 }
        )
      }

      sequence.gates[gateIndex].status = 'APPROVED'

      for (const step of sequence.steps) {
        if (step.status !== 'BLOCKED') continue
        if (!step.depends_on.includes(gateId)) continue

        const allSatisfied = step.depends_on.every(depId => {
          const depStep = sequence.steps.find(s => s.id === depId)
          if (depStep) return depStep.status === 'DONE'
          const depGate = sequence.gates.find(g => g.id === depId)
          if (depGate) return depGate.status === 'APPROVED'
          return false
        })

        if (allSatisfied) {
          step.status = 'READY'
        }
      }

      await writeSequence(basePath, sequence)

      return NextResponse.json({
        success: true,
        action: 'approve',
        gateId,
        message: `Gate '${gateId}' approved`,
      })
    }

    // action === 'block'
    const gateIndex = sequence.gates.findIndex(g => g.id === gateId)
    if (gateIndex === -1) {
      return NextResponse.json(
        { error: new GateNotFoundError(gateId).message },
        { status: 404 }
      )
    }

    sequence.gates[gateIndex].status = 'BLOCKED'
    await writeSequence(basePath, sequence)

    return NextResponse.json({
      success: true,
      action: 'block',
      gateId,
      message: `Gate '${gateId}' blocked`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process gate operation' },
      { status: 500 }
    )
  }
}
