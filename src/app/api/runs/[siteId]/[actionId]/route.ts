import { NextRequest, NextResponse } from 'next/server'
import { getAction } from '@/lib/sites.generated'
import { listRuns } from '@/lib/github'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ siteId: string; actionId: string }> }
) {
  const { siteId, actionId } = await ctx.params
  const action = getAction(siteId, actionId)
  if (!action || action.type !== 'github-workflow') {
    return NextResponse.json({ error: 'unsupported' }, { status: 404 })
  }
  try {
    const runs = await listRuns(action.repo, action.workflow, 20)
    return NextResponse.json({ runs })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
