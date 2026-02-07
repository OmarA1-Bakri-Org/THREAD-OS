import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence, writeSequence } from '@/lib/sequence/parser'
import { validateDAG } from '@/lib/sequence/dag'
import {
  StepSchema,
  type Step,
  type StepType,
  type ModelType,
  type StepStatus,
} from '@/lib/sequence/schema'
import { StepNotFoundError } from '@/lib/errors'

const AddStepBodySchema = z.object({
  action: z.literal('add'),
  stepId: z.string().min(1),
  name: z.string().optional(),
  type: z.enum(['base', 'p', 'c', 'f', 'b', 'l']).optional(),
  model: z.enum(['claude-code', 'codex', 'gemini']).optional(),
  prompt_file: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  cwd: z.string().optional(),
})

const EditStepBodySchema = z.object({
  action: z.literal('edit'),
  stepId: z.string().min(1),
  name: z.string().optional(),
  type: z.enum(['base', 'p', 'c', 'f', 'b', 'l']).optional(),
  model: z.enum(['claude-code', 'codex', 'gemini']).optional(),
  prompt_file: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  status: z
    .enum(['READY', 'RUNNING', 'NEEDS_REVIEW', 'DONE', 'FAILED', 'BLOCKED'])
    .optional(),
  cwd: z.string().optional(),
})

const RmStepBodySchema = z.object({
  action: z.literal('rm'),
  stepId: z.string().min(1),
})

const CloneStepBodySchema = z.object({
  action: z.literal('clone'),
  sourceId: z.string().min(1),
  newId: z.string().min(1),
})

const StepActionSchema = z.discriminatedUnion('action', [
  AddStepBodySchema,
  EditStepBodySchema,
  RmStepBodySchema,
  CloneStepBodySchema,
])

async function handleAdd(body: z.infer<typeof AddStepBodySchema>) {
  const basePath = process.cwd()
  const sequence = await readSequence(basePath)

  if (sequence.steps.some((s) => s.id === body.stepId)) {
    return NextResponse.json(
      { error: `Step '${body.stepId}' already exists` },
      { status: 400 }
    )
  }

  const newStep: Step = {
    id: body.stepId,
    name: body.name ?? body.stepId,
    type: (body.type ?? 'base') as StepType,
    model: (body.model ?? 'claude-code') as ModelType,
    prompt_file:
      body.prompt_file ?? `.threados/prompts/${body.stepId}.md`,
    depends_on: body.depends_on ?? [],
    status: 'READY' as StepStatus,
    cwd: body.cwd,
  }

  const validation = StepSchema.safeParse(newStep)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  sequence.steps.push(validation.data)

  try {
    validateDAG(sequence)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'DAG validation failed',
      },
      { status: 400 }
    )
  }

  await writeSequence(basePath, sequence)

  return NextResponse.json({
    success: true,
    action: 'add',
    stepId: body.stepId,
    message: `Step '${body.stepId}' added successfully`,
  })
}

async function handleEdit(body: z.infer<typeof EditStepBodySchema>) {
  const basePath = process.cwd()
  const sequence = await readSequence(basePath)

  const stepIndex = sequence.steps.findIndex((s) => s.id === body.stepId)
  if (stepIndex === -1) {
    return NextResponse.json(
      { error: new StepNotFoundError(body.stepId).message },
      { status: 404 }
    )
  }

  const step = { ...sequence.steps[stepIndex] }

  if (body.name !== undefined) step.name = body.name
  if (body.type !== undefined) step.type = body.type as StepType
  if (body.model !== undefined) step.model = body.model as ModelType
  if (body.prompt_file !== undefined) step.prompt_file = body.prompt_file
  if (body.status !== undefined) step.status = body.status as StepStatus
  if (body.cwd !== undefined) step.cwd = body.cwd
  if (body.depends_on !== undefined) step.depends_on = body.depends_on

  const validation = StepSchema.safeParse(step)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  sequence.steps[stepIndex] = validation.data

  try {
    validateDAG(sequence)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'DAG validation failed',
      },
      { status: 400 }
    )
  }

  await writeSequence(basePath, sequence)

  return NextResponse.json({
    success: true,
    action: 'edit',
    stepId: body.stepId,
    message: `Step '${body.stepId}' updated successfully`,
  })
}

async function handleRm(body: z.infer<typeof RmStepBodySchema>) {
  const basePath = process.cwd()
  const sequence = await readSequence(basePath)

  const stepIndex = sequence.steps.findIndex((s) => s.id === body.stepId)
  if (stepIndex === -1) {
    return NextResponse.json(
      { error: new StepNotFoundError(body.stepId).message },
      { status: 404 }
    )
  }

  const dependents = sequence.steps.filter((s) =>
    s.depends_on.includes(body.stepId)
  )
  if (dependents.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot remove: steps [${dependents.map((s) => s.id).join(', ')}] depend on '${body.stepId}'`,
      },
      { status: 400 }
    )
  }

  sequence.steps.splice(stepIndex, 1)
  await writeSequence(basePath, sequence)

  return NextResponse.json({
    success: true,
    action: 'rm',
    stepId: body.stepId,
    message: `Step '${body.stepId}' removed successfully`,
  })
}

async function handleClone(body: z.infer<typeof CloneStepBodySchema>) {
  const basePath = process.cwd()
  const sequence = await readSequence(basePath)

  const sourceStep = sequence.steps.find((s) => s.id === body.sourceId)
  if (!sourceStep) {
    return NextResponse.json(
      { error: new StepNotFoundError(body.sourceId).message },
      { status: 404 }
    )
  }

  if (sequence.steps.some((s) => s.id === body.newId)) {
    return NextResponse.json(
      { error: `Step '${body.newId}' already exists` },
      { status: 400 }
    )
  }

  const clonedStep: Step = {
    ...sourceStep,
    id: body.newId,
    name: `${sourceStep.name} (copy)`,
    prompt_file: `.threados/prompts/${body.newId}.md`,
    status: 'READY',
  }

  const validation = StepSchema.safeParse(clonedStep)
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues.map((e) => e.message).join(', ') },
      { status: 400 }
    )
  }

  sequence.steps.push(validation.data)

  try {
    validateDAG(sequence)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'DAG validation failed',
      },
      { status: 400 }
    )
  }

  await writeSequence(basePath, sequence)

  return NextResponse.json({
    success: true,
    action: 'clone',
    stepId: body.newId,
    message: `Step '${body.sourceId}' cloned to '${body.newId}'`,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = StepActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Invalid request: ${parsed.error.issues.map((e) => e.message).join(', ')}`,
        },
        { status: 400 }
      )
    }

    switch (parsed.data.action) {
      case 'add':
        return await handleAdd(parsed.data)
      case 'edit':
        return await handleEdit(parsed.data)
      case 'rm':
        return await handleRm(parsed.data)
      case 'clone':
        return await handleClone(parsed.data)
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process step operation',
      },
      { status: 500 }
    )
  }
}
