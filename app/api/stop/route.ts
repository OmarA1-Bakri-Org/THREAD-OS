import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { MprocsClient } from '@/lib/mprocs/client'
import { readMprocsMap } from '@/lib/mprocs/state'
import { StepNotFoundError } from '@/lib/errors'

const StopBodySchema = z.object({
  stepId: z.string().min(1, 'stepId is required'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = StopBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Invalid request: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        },
        { status: 400 }
      )
    }

    const { stepId } = parsed.data
    const basePath = process.cwd()
    const sequence = await readSequence(basePath)

    const step = sequence.steps.find((s) => s.id === stepId)
    if (!step) {
      return NextResponse.json(
        { error: new StepNotFoundError(stepId).message },
        { status: 404 }
      )
    }

    if (step.status !== 'RUNNING') {
      return NextResponse.json(
        {
          error: `Step '${stepId}' is not running (status: ${step.status})`,
        },
        { status: 400 }
      )
    }

    const mprocsMap = await readMprocsMap(basePath)
    const processIndex = mprocsMap[stepId]

    if (processIndex === undefined) {
      return NextResponse.json(
        {
          error: `No process index found for step '${stepId}' in mprocs-map.json`,
        },
        { status: 400 }
      )
    }

    const mprocsClient = new MprocsClient()
    await mprocsClient.stopProcess(processIndex)

    step.status = 'FAILED'
    await writeSequence(basePath, sequence)

    return NextResponse.json({
      success: true,
      action: 'stop',
      stepId,
      status: step.status,
      message: `Step '${stepId}' stopped successfully`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to stop step',
      },
      { status: 500 }
    )
  }
}
