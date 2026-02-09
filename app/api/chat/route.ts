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
  policyMode: z.enum(['SAFE', 'POWER']).default('SAFE'),
})

const ApplyActionsSchema = z.object({
  actions: z.array(z.object({
    id: z.string(),
    command: z.string(),
    description: z.string(),
    destructive: z.boolean().default(false),
    reversible: z.boolean().default(true),
  })),
  policyMode: z.enum(['SAFE', 'POWER']).default('SAFE'),
})

/**
 * Handle an incoming chat request and return a system prompt together with sequence context.
 *
 * @returns A NextResponse containing either:
 *  - on success: an object with `success: true`, `systemPrompt`, `sequenceContext` (name, `stepCount`, `gateCount`, `steps`, `gates`) and `mode`; or
 *  - on failure: an object with `error` and an HTTP status (400 for validation errors, 500 for server errors).
 */
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
    const { policyMode } = parsed.data
    const systemPrompt = generateSystemPrompt(sequence, policyMode)
    const logger = new AuditLogger(basePath)

    await logger.log({
      action: 'chat.message',
      actor: 'user',
      target: 'sequence',
      payload: { message: parsed.data.message, mode: parsed.data.mode },
      policy_mode: policyMode,
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

/**
 * Apply proposed actions: validate them, perform a dry-run, log the application and return the resulting diff.
 *
 * Performs schema validation on the request body, validates action semantics according to the provided
 * policy mode, executes a dry-run to compute the sequence diff, logs the successful application and
 * returns the dry-run diff and action count. On validation or dry-run failure the response indicates the
 * failing phase and includes the associated errors; on malformed input or unexpected errors the response
 * contains an error message.
 *
 * @returns A JSON object describing the outcome:
 * - On success: `{ success: true, phase: 'validated', dryRunDiff: <diff>, actionCount: <number> }`.
 * - On action validation failure: `{ success: false, phase: 'validation', errors: <validationErrors> }`.
 * - On dry-run failure: `{ success: false, phase: 'dry-run', errors: <dryRunErrors> }`.
 * - On malformed request: `{ error: <message> }` (400).
 * - On unexpected server error: `{ error: <message> }` (500).
 */
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
    const { policyMode } = parsed.data

    const validation = validateActions(actions, policyMode)
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        phase: 'validation',
        errors: validation.errors,
      }, { status: 400 })
    }

    const dryRun = await dryRunActions(basePath, actions, policyMode)
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
      policy_mode: policyMode,
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