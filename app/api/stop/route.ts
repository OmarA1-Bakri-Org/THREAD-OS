import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { getBasePath } from '@/lib/config'
import { jsonError, auditLog, handleError } from '@/lib/api-helpers'
import { MprocsClient } from '@/lib/mprocs/client'
import { readMprocsMap } from '@/lib/mprocs/state'
import { StepNotFoundError } from '@/lib/errors'

const BodySchema = z.object({ stepId: z.string() })

export async function POST(request: Request) {
  try {
    const { stepId } = BodySchema.parse(await request.json())
    const bp = getBasePath()
    const seq = await readSequence(bp)
    const step = seq.steps.find(s => s.id === stepId)
    if (!step) throw new StepNotFoundError(stepId)

    const mprocsMap = await readMprocsMap(bp)
    const idx = mprocsMap[stepId]
    if (idx !== undefined) {
      try { await new MprocsClient().stopProcess(idx) } catch { /* ok */ }
    }
    step.status = 'FAILED'
    await writeSequence(bp, seq)
    await auditLog('stop', stepId)
    return NextResponse.json({ success: true, action: 'stop', stepId })
  } catch (err) {
    return handleError(err)
  }
}
