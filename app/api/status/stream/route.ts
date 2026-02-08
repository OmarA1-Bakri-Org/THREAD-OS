import { readSequence } from '@/lib/sequence/parser'
import { readMprocsMap } from '@/lib/mprocs/state'
import { getBasePath } from '@/lib/config'
import { buildStatus } from '../route'

export async function GET() {
  const encoder = new TextEncoder()
  let cancelled = false

  const stream = new ReadableStream({
    async start(controller) {
      let lastJson = ''
      while (!cancelled) {
        try {
          const bp = getBasePath()
          const [seq, map] = await Promise.all([readSequence(bp), readMprocsMap(bp)])
          const status = buildStatus(seq, map)
          const json = JSON.stringify(status)
          if (json !== lastJson) {
            lastJson = json
            controller.enqueue(encoder.encode(`data: ${json}\n\n`))
          }
        } catch {
          // skip errors in poll
        }
        await new Promise(r => setTimeout(r, 500))
      }
    },
    cancel() {
      cancelled = true
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
