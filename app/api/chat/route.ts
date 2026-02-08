import { NextRequest } from 'next/server'
import { readSequence } from '@/lib/sequence/parser'
import { buildSystemPrompt } from '@/lib/chat/system-prompt'
import { ActionValidator } from '@/lib/chat/validator'

const BASE_PATH = process.cwd()

/**
 * Chat API endpoint — SSE stream
 * POST { message: string }
 * Returns SSE events: message, actions, diff, done
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message } = body

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`))
      }

      try {
        // Try to load current sequence
        let sequence
        try {
          sequence = await readSequence(BASE_PATH)
        } catch {
          sequence = null
        }

        // If ANTHROPIC_API_KEY is set, we'd call Claude here
        // For now, echo the message with context-aware response
        if (process.env.ANTHROPIC_API_KEY && sequence) {
          // Future: call Anthropic API with buildSystemPrompt(sequence)
          // const systemPrompt = buildSystemPrompt(sequence)
          // Stream response chunks as type: 'message'
          // Parse actions from response as type: 'actions'
          // Run dry-run and send type: 'diff'
        }

        // Stub response
        const responseText = sequence
          ? `I see your sequence "${sequence.name}" with ${sequence.steps.length} steps. You said: "${message}". I'm ready to help manage your sequence — but I need an LLM API key to provide intelligent suggestions.`
          : `No sequence found. You said: "${message}". Try running \`seqctl init\` first to create a sequence.`

        send('message', { content: responseText })
        send('actions', { actions: [] })
        send('done', {})
      } catch (error) {
        send('message', { content: `Error: ${(error as Error).message}` })
        send('done', {})
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
