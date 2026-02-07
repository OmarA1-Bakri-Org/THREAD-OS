import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { validateDAG } from '@/lib/sequence/dag'
import { StepNotFoundError } from '@/lib/errors'

const DepBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    stepId: z.string().min(1),
    depId: z.string().min(1),
  }),
  z.object({
    action: z.literal('rm'),
    stepId: z.string().min(1),
    depId: z.string().min(1),
  }),
])

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = DepBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parsed.error.issues.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const basePath = process.cwd()
    const sequence = await readSequence(basePath)
    const { action, stepId, depId } = parsed.data

    const step = sequence.steps.find(s => s.id === stepId)
    if (!step) {
      return NextResponse.json(
        { error: new StepNotFoundError(stepId).message },
        { status: 404 }
      )
    }

    if (action === 'add') {
      const nodeExists =
        sequence.steps.some(s => s.id === depId) ||
        sequence.gates.some(g => g.id === depId)

      if (!nodeExists) {
        return NextResponse.json(
          { error: `Dependency target not found: ${depId}` },
          { status: 404 }
        )
      }

      if (step.depends_on.includes(depId)) {
        return NextResponse.json(
          { error: `Step '${stepId}' already depends on '${depId}'` },
          { status: 400 }
        )
      }

      step.depends_on.push(depId)

      try {
        validateDAG(sequence)
      } catch (error) {
        step.depends_on.pop()
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'DAG validation failed' },
          { status: 400 }
        )
      }

      await writeSequence(basePath, sequence)

      return NextResponse.json({
        success: true,
        action: 'add',
        stepId,
        depId,
        message: `Dependency '${depId}' added to step '${stepId}'`,
      })
    }

    // action === 'rm'
    const depIndex = step.depends_on.indexOf(depId)
    if (depIndex === -1) {
      return NextResponse.json(
        { error: `Step '${stepId}' does not depend on '${depId}'` },
        { status: 400 }
      )
    }

    step.depends_on.splice(depIndex, 1)
    await writeSequence(basePath, sequence)

    return NextResponse.json({
      success: true,
      action: 'rm',
      stepId,
      depId,
      message: `Dependency '${depId}' removed from step '${stepId}'`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process dependency operation' },
      { status: 500 }
    )
  }
}
