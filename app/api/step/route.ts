import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { validateDAG } from '@/lib/sequence/dag'
import { getBasePath } from '@/lib/config'
import { jsonError, auditLog, handleError } from '@/lib/api-helpers'
import { StepNotFoundError } from '@/lib/errors'
import { writePrompt, deletePrompt, validatePromptExists } from '@/lib/prompts/manager'
import { StepSchema, StepTypeSchema, ModelTypeSchema, StepStatusSchema, type Step } from '@/lib/sequence/schema'

const AddSchema = z.object({
  action: z.literal('add'),
  stepId: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  cwd: z.string().optional(),
})

const EditSchema = z.object({
  action: z.literal('edit'),
  stepId: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().optional(),
  status: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  cwd: z.string().optional(),
})

const RmSchema = z.object({ action: z.literal('rm'), stepId: z.string() })
const CloneSchema = z.object({ action: z.literal('clone'), sourceId: z.string(), newId: z.string() })

const BodySchema = z.union([AddSchema, EditSchema, RmSchema, CloneSchema])

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json())
    const bp = getBasePath()
    const seq = await readSequence(bp)

    if (body.action === 'add') {
      if (seq.steps.some(s => s.id === body.stepId)) return jsonError(`Step '${body.stepId}' already exists`, 'CONFLICT', 409)
      const newStep = {
        id: body.stepId,
        name: body.name || body.stepId,
        type: body.type || 'base',
        model: body.model || 'claude-code',
        prompt_file: body.prompt || `.threados/prompts/${body.stepId}.md`,
        depends_on: body.dependsOn || [],
        status: 'READY' as const,
        cwd: body.cwd,
      }
      const v = StepSchema.safeParse(newStep)
      if (!v.success) return jsonError(v.error.issues.map(e => e.message).join(', '), 'VALIDATION_ERROR', 400)
      seq.steps.push(v.data)
      validateDAG(seq)
      await writeSequence(bp, seq)
      if (!(await validatePromptExists(bp, body.stepId))) {
        await writePrompt(bp, body.stepId, `# ${v.data.name}\n\n<!-- Add your prompt here -->\n`)
      }
      await auditLog('step.add', body.stepId)
      return NextResponse.json({ success: true, action: 'add', stepId: body.stepId })
    }

    if (body.action === 'edit') {
      const step = seq.steps.find(s => s.id === body.stepId)
      if (!step) throw new StepNotFoundError(body.stepId)
      if (body.name) step.name = body.name
      if (body.type) {
        const parsed = StepTypeSchema.safeParse(body.type)
        if (!parsed.success) return jsonError(`Invalid step type: ${body.type}`, 'VALIDATION_ERROR', 400)
        step.type = parsed.data
      }
      if (body.model) {
        const parsed = ModelTypeSchema.safeParse(body.model)
        if (!parsed.success) return jsonError(`Invalid model: ${body.model}`, 'VALIDATION_ERROR', 400)
        step.model = parsed.data
      }
      if (body.prompt) step.prompt_file = body.prompt
      if (body.status) {
        const parsed = StepStatusSchema.safeParse(body.status)
        if (!parsed.success) return jsonError(`Invalid status: ${body.status}`, 'VALIDATION_ERROR', 400)
        step.status = parsed.data
      }
      if (body.dependsOn) step.depends_on = body.dependsOn
      if (body.cwd) step.cwd = body.cwd
      validateDAG(seq)
      await writeSequence(bp, seq)
      await auditLog('step.edit', body.stepId)
      return NextResponse.json({ success: true, action: 'edit', stepId: body.stepId })
    }

    if (body.action === 'rm') {
      const idx = seq.steps.findIndex(s => s.id === body.stepId)
      if (idx === -1) throw new StepNotFoundError(body.stepId)
      const deps = seq.steps.filter(s => s.depends_on.includes(body.stepId))
      if (deps.length > 0) return jsonError(`Steps [${deps.map(s => s.id).join(', ')}] depend on '${body.stepId}'`, 'HAS_DEPENDENTS', 409)
      seq.steps.splice(idx, 1)
      await writeSequence(bp, seq)
      try { await deletePrompt(bp, body.stepId) } catch { /* ok */ }
      await auditLog('step.rm', body.stepId)
      return NextResponse.json({ success: true, action: 'rm', stepId: body.stepId })
    }

    // clone
    const src = seq.steps.find(s => s.id === body.sourceId)
    if (!src) throw new StepNotFoundError(body.sourceId)
    if (seq.steps.some(s => s.id === body.newId)) return jsonError(`Step '${body.newId}' already exists`, 'CONFLICT', 409)
    const cloned: Step = { ...src, id: body.newId, name: `${src.name} (copy)`, prompt_file: `.threados/prompts/${body.newId}.md`, status: 'READY' }
    seq.steps.push(cloned)
    validateDAG(seq)
    await writeSequence(bp, seq)
    await writePrompt(bp, body.newId, `# ${cloned.name}\n\n<!-- Add your prompt here -->\n`)
    await auditLog('step.clone', body.newId, { sourceId: body.sourceId })
    return NextResponse.json({ success: true, action: 'clone', stepId: body.newId })
  } catch (err) {
    return handleError(err)
  }
}
