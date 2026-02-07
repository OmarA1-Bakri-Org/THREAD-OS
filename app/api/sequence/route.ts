import { NextResponse } from 'next/server'
import { readSequence } from '@/lib/sequence/parser'

export async function GET() {
  try {
    const sequence = await readSequence(process.cwd())
    return NextResponse.json(sequence)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read sequence' },
      { status: 500 }
    )
  }
}
