import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { validateDAG } from '@/lib/sequence/dag'
import { getBasePath } from '@/lib/config'
import { jsonError, auditLog, handleError } from '@/lib/api-helpers'
import { StepNotFoundError } from '@/lib/errors'

const BodySchema = z.union([
  z.object({ action: z.literal('add'), stepId: z.string(), depId: z.string() }),
  z.object({ action: z.literal('rm'), stepId: z.string(), depId: z.string() }),
])

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json())
    const bp = getBasePath()
    const seq = await readSequence(bp)
    const step = seq.steps.find(s => s.id === body.stepId)
    if (!step) throw new StepNotFoundError(body.stepId)

    if (body.action === 'add') {
      const exists = seq.steps.some(s => s.id === body.depId) || seq.gates.some(g => g.id === body.depId)
      if (!exists) return jsonError(`Node '${body.depId}' does not exist`, 'NOT_FOUND', 404)
      if (step.depends_on.includes(body.depId)) return jsonError('Dependency already exists', 'CONFLICT', 409)
      step.depends_on.push(body.depId)
      try { validateDAG(seq) } catch (e) { step.depends_on.pop(); throw e }
      await writeSequence(bp, seq)
      await auditLog('dep.add', body.stepId, { depId: body.depId })
      return NextResponse.json({ success: true, action: 'add', stepId: body.stepId, depId: body.depId })
    }

    const idx = step.depends_on.indexOf(body.depId)
    if (idx === -1) return jsonError(`Dependency '${body.depId}' not found`, 'NOT_FOUND', 404)
    step.depends_on.splice(idx, 1)
    await writeSequence(bp, seq)
    await auditLog('dep.rm', body.stepId, { depId: body.depId })
    return NextResponse.json({ success: true, action: 'rm', stepId: body.stepId, depId: body.depId })
  } catch (err) {
    return handleError(err)
  }
}
