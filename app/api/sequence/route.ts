import { NextResponse } from 'next/server'
import { readSequence } from '@/lib/sequence/parser'
import { getBasePath } from '@/lib/config'
import { handleError } from '@/lib/api-helpers'

export async function GET() {
  try {
    const sequence = await readSequence(getBasePath())
    return NextResponse.json(sequence)
  } catch (err) {
    return handleError(err)
  }
}
