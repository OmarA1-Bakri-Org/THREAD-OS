import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readSequence } from '@/lib/sequence/parser'
import { generateSystemPrompt } from '@/lib/chat/system-prompt'
import {
  validateActions,
  dryRunActions,
  type ProposedAction,
} from '@/lib/chat/validator'
import { AuditLogger } from '@/lib/audit/logger'

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  mode: z.enum(['plan', 'execute']).default('plan'),
})

const ApplyActionsSchema = z.object({
  actions: z.array(z.object({
    id: z.string(),
    command: z.string(),
    description: z.string(),
    destructive: z.boolean().default(false),
    reversible: z.boolean().default(true),
  })),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parsed.error.issues.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const basePath = process.cwd()
    const sequence = await readSequence(basePath)
    const systemPrompt = generateSystemPrompt(sequence, 'SAFE')
    const logger = new AuditLogger(basePath)

    await logger.log({
      action: 'chat.message',
      actor: 'user',
      target: 'sequence',
      payload: { message: parsed.data.message, mode: parsed.data.mode },
      policy_mode: 'SAFE',
      result: 'success',
    })

    return NextResponse.json({
      success: true,
      systemPrompt,
      sequenceContext: {
        name: sequence.name,
        stepCount: sequence.steps.length,
        gateCount: sequence.gates.length,
        steps: sequence.steps.map(s => ({
          id: s.id,
          name: s.name,
          status: s.status,
          type: s.type,
        })),
        gates: sequence.gates.map(g => ({
          id: g.id,
          name: g.name,
          status: g.status,
        })),
      },
      mode: parsed.data.mode,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const parsed = ApplyActionsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parsed.error.issues.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const basePath = process.cwd()
    const logger = new AuditLogger(basePath)
    const actions: ProposedAction[] = parsed.data.actions

    const validation = validateActions(actions)
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        phase: 'validation',
        errors: validation.errors,
      }, { status: 400 })
    }

    const dryRun = await dryRunActions(basePath, actions)
    if (!dryRun.success) {
      return NextResponse.json({
        success: false,
        phase: 'dry-run',
        errors: dryRun.errors,
      }, { status: 400 })
    }

    await logger.log({
      action: 'chat.apply',
      actor: 'orchestrator',
      target: 'sequence',
      payload: {
        actionCount: actions.length,
        actions: actions.map(a => ({ id: a.id, command: a.command })),
        dryRunDiff: dryRun.sequenceDiff,
      },
      policy_mode: 'SAFE',
      result: 'success',
    })

    return NextResponse.json({
      success: true,
      phase: 'validated',
      dryRunDiff: dryRun.sequenceDiff,
      actionCount: actions.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply actions' },
      { status: 500 }
    )
  }
}
