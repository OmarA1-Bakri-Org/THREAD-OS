import { NextResponse } from 'next/server'
import { AuditLogger } from '@/lib/audit/logger'

export async function GET(request: Request) {
  try {
    const basePath = process.cwd()
    const logger = new AuditLogger(basePath)
    const url = new URL(request.url)

    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    const entries = await logger.read({ limit, offset })

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
      offset,
      limit,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read audit log' },
      { status: 500 }
    )
  }
}
