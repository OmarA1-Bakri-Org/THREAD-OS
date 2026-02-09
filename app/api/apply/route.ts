import { NextRequest } from 'next/server'
import { ActionValidator, type ProposedAction } from '@/lib/chat/validator'

const BASE_PATH = process.cwd()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { actions } = body as { actions: ProposedAction[] }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return Response.json({ success: false, errors: ['No actions provided'] }, { status: 400 })
    }

    const validator = new ActionValidator(BASE_PATH)
    const result = await validator.apply(actions)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { success: false, errors: [(error as Error).message] },
      { status: 500 }
    )
  }
}
