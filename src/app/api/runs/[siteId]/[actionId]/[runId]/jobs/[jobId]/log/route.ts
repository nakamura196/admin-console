import { NextRequest, NextResponse } from 'next/server'
import { getAction } from '@/lib/sites.generated'
import { fetchJobLog } from '@/lib/github'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: {
    params: Promise<{
      siteId: string
      actionId: string
      runId: string
      jobId: string
    }>
  }
) {
  const { siteId, actionId, jobId } = await ctx.params
  const action = getAction(siteId, actionId)
  if (!action || action.type !== 'github-workflow') {
    return new NextResponse('unsupported', { status: 404 })
  }
  try {
    const log = await fetchJobLog(action.repo, parseInt(jobId, 10))
    return new NextResponse(log, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 })
  }
}
