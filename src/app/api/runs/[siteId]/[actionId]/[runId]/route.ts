import { NextRequest, NextResponse } from 'next/server'
import { getAction } from '@/lib/sites.generated'
import { listJobs } from '@/lib/github'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ siteId: string; actionId: string; runId: string }> }
) {
  const { siteId, actionId, runId } = await ctx.params
  const action = getAction(siteId, actionId)
  if (!action || action.type !== 'github-workflow') {
    return NextResponse.json({ error: 'unsupported' }, { status: 404 })
  }
  try {
    const jobs = await listJobs(action.repo, parseInt(runId, 10))
    return NextResponse.json({ jobs })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
