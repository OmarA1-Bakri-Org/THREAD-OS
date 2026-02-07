import { readSequence } from '@/lib/sequence/parser'
import { readMprocsMap } from '@/lib/mprocs/state'
import { buildSequenceStatus } from '@/app/api/status/route'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const encoder = new TextEncoder()
  let intervalId: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      intervalId = setInterval(async () => {
        try {
          const basePath = process.cwd()
          const [sequence, mprocsMap] = await Promise.all([
            readSequence(basePath),
            readMprocsMap(basePath),
          ])

          const status = buildSequenceStatus(sequence, mprocsMap)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(status)}\n\n`)
          )
        } catch {
          // Ignore errors during polling to keep the stream alive
        }
      }, 500)

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        if (intervalId !== null) {
          clearInterval(intervalId)
          intervalId = null
        }
        controller.close()
      })
    },
    cancel() {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
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
